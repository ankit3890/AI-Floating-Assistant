const { BrowserWindow, screen, ipcMain, globalShortcut, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Simple storage
const storePath = path.join(require('electron').app.getPath('userData'), 'window-state.json');
const store = {
    get: (key, defaultValue) => {
        try {
            const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
            return data[key] !== undefined ? data[key] : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            let data = {};
            try {
                data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
            } catch {}
            data[key] = value;
            fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Failed to save state:', err);
        }
    }
};

let mainWindow;
let drawingOverlayWindow;

function createWindow(isStartupLaunch) {
    // Get cursor position to determine which monitor to open on
    const cursorPoint = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);

    // Get saved bounds using unique window name per display if possible, or just general
    const savedBounds = store.get(`windowBounds_${currentDisplay.id}`, {
        width: 1000,
        height: 700,
        x: undefined,
        y: undefined
    });

    mainWindow = new BrowserWindow({
        width: savedBounds.width,
        height: savedBounds.height,
        x: savedBounds.x,
        y: savedBounds.y,
        minWidth: 400,
        minHeight: 500,
        frame: true,
        alwaysOnTop: true,
        icon: path.join(__dirname, '../../assets/icons/logo.png'),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            webviewTag: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true,
        show: false,
    });

    mainWindow.setMenu(null);
    // Point to the moved index.html
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

    mainWindow.once('ready-to-show', () => {
        // Open DevTools for debugging
        // mainWindow.webContents.openDevTools();
        
        if (isStartupLaunch) {
            console.log('App launched via Auto-Startup. Opening in background.');
            mainWindow.showInactive();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Save window position
    const saveWindowBounds = () => {
        if (!mainWindow) return;
        const bounds = mainWindow.getBounds();
        const display = screen.getDisplayMatching(bounds);
        store.set(`windowBounds_${display.id}`, bounds);
    };

    mainWindow.on('moved', saveWindowBounds);
    mainWindow.on('resized', saveWindowBounds);

    // Snap to edges
    const SNAP_THRESHOLD = 20;
    mainWindow.on('will-move', (event, newBounds) => {
        const display = screen.getDisplayMatching(newBounds);
        const { x, y, width, height } = display.workArea;

        if (Math.abs(newBounds.x - x) < SNAP_THRESHOLD) newBounds.x = x;
        if (Math.abs((newBounds.x + newBounds.width) - (x + width)) < SNAP_THRESHOLD) newBounds.x = x + width - newBounds.width;
        if (Math.abs(newBounds.y - y) < SNAP_THRESHOLD) newBounds.y = y;
        if (Math.abs((newBounds.y + newBounds.height) - (y + height)) < SNAP_THRESHOLD) newBounds.y = y + height - newBounds.height;

        mainWindow.setBounds(newBounds);
    });

    // Open external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    setupGlobalShortcuts();
    setupIpcHandlers();
    
    return mainWindow;
}

function setupGlobalShortcuts() {
    // Visibility Toggle
    globalShortcut.register("CommandOrControl+Shift+A", () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Context Send
    globalShortcut.register("CommandOrControl+Shift+C", () => {
        // Powershell clipboard simulation
        const copyCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^c')"`;
        exec(copyCommand, (error) => {
             // ... error handling
             setTimeout(() => {
                 const clipboardText = clipboard.readText();
                 if (mainWindow) {
                     mainWindow.show();
                     mainWindow.focus();
                     mainWindow.webContents.send('context-send-triggered', clipboardText || '');
                 }
             }, 300);
        });
    });

    // AI Switchers 1-9
    [1,2,3,4,5,6,7,8,9].forEach((key, index) => {
        globalShortcut.register(`CommandOrControl+${key}`, () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
                mainWindow.webContents.send('switch-to-ai-index', index); // index is 0-based in array
            }
        });
    });

    // Tools
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow) mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('toggle-compare-mode');
    });



    globalShortcut.register('CommandOrControl+Shift+H', () => {
         // Drawing Overlay Logic
         if (drawingOverlayWindow && !drawingOverlayWindow.isDestroyed()) {
             closeDrawingOverlay();
         } else {
             if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
             createDrawingOverlay();
         }
    });
}

function closeDrawingOverlay() {
    if (drawingOverlayWindow && !drawingOverlayWindow.isDestroyed()) {
        drawingOverlayWindow.close();
        drawingOverlayWindow = null;
    }
    restoreMainWindow();
}

function restoreMainWindow() {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        // Force to top if it was pinned
        if (mainWindow.isAlwaysOnTop()) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    }
}

function createDrawingOverlay() {
    if (drawingOverlayWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { x, y, width, height } = display.bounds;

    drawingOverlayWindow = new BrowserWindow({
        x, y, width, height,
        frame: false,
        transparent: true,
        fullscreen: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });
    // Load moved file
    drawingOverlayWindow.loadFile(path.join(__dirname, "../renderer/features/screen-drawing/screen-drawing.html"));
    
    drawingOverlayWindow.on('closed', () => drawingOverlayWindow = null);
}


function setupIpcHandlers() {
    ipcMain.handle("toggle-always-on-top", (event, flag) => {
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(flag);
            return mainWindow.isAlwaysOnTop();
        }
        return false;
    });

    let preCollapseBounds = null;
    ipcMain.on('collapse-window', () => {
        if (!mainWindow) return;
        preCollapseBounds = mainWindow.getBounds();
        mainWindow.setMinimumSize(0, 0);
        mainWindow.setSize(220, 100, true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    });
    
    ipcMain.on('expand-window', () => {
        if (!mainWindow || !preCollapseBounds) return;
        mainWindow.setBounds(preCollapseBounds, true);
        setTimeout(() => mainWindow.setMinimumSize(400, 500), 500);
    });

    ipcMain.on('hide-window', () => {
        if (mainWindow) {
            mainWindow.hide();
        }
    });

    // Screen Drawing Handlers
    ipcMain.handle('open-screen-drawing', () => {
        if (mainWindow && mainWindow.isVisible()) {
            mainWindow.hide();
        }
        createDrawingOverlay();
    });

    ipcMain.handle('open-external', async (event, url) => {
        await shell.openExternal(url);
    });

    ipcMain.on('draw-exit', () => {
        closeDrawingOverlay();
    });
}

module.exports = { createWindow };
