const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  shell,
  clipboard,
  screen,
  dialog,
  desktopCapturer,
} = require("electron");
const path = require("path");
const { exec } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws'); // Added ws

console.log('--------------------------------------------------');
console.log('--- OPENROUTER / DEEPSEEK VERSION LOADED v2.5  ---');
console.log('--------------------------------------------------');

// Simple storage using JSON file
const storePath = path.join(app.getPath('userData'), 'window-state.json');
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

function createWindow() {
  // Get cursor position to determine which monitor to open on
  const cursorPoint = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
  
  // Get saved bounds for THIS monitor
  const savedBounds = store.get(`windowBounds_${currentDisplay.id}`, {
    width: 1000,
    height: 700,
    x: undefined,
    y: undefined
  });

  // Ensure bounds are valid for this display (prevent off-screen)
  // ... basic check if x,y are within bounds
  
  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 400,
    minHeight: 500,
    frame: true, 
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile("index.html");

  // Inject headers to bypass Google's Electron detection
  // Apply to the webview's partition session, not the main window
  const { session } = require('electron');
  const webviewSession = session.fromPartition('persist:ai_session');
  
  webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Set Firefox-like headers (don't delete, just override)
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0';
    details.requestHeaders['sec-ch-ua'] = '"Not A(Brand";v="99", "Firefox";v="124"';
    details.requestHeaders['sec-ch-ua-mobile'] = '?0';
    details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
    
    callback({ requestHeaders: details.requestHeaders });
  });

  // Save window position PER MONITOR
  const saveWindowBounds = () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    store.set(`windowBounds_${display.id}`, bounds);
  };

  mainWindow.on('moved', saveWindowBounds);
  mainWindow.on('resized', saveWindowBounds);

  // Auto-dock to edges
  const SNAP_THRESHOLD = 20;
  mainWindow.on('will-move', (event, newBounds) => {
    const display = screen.getDisplayMatching(newBounds);
    const { x, y, width, height } = display.workArea;

    // Snap to left edge
    if (Math.abs(newBounds.x - x) < SNAP_THRESHOLD) {
      newBounds.x = x;
    }
    // Snap to right edge
    if (Math.abs((newBounds.x + newBounds.width) - (x + width)) < SNAP_THRESHOLD) {
      newBounds.x = x + width - newBounds.width;
    }
    // Snap to top edge
    if (Math.abs(newBounds.y - y) < SNAP_THRESHOLD) {
      newBounds.y = y;
    }
    // Snap to bottom edge
    if (Math.abs((newBounds.y + newBounds.height) - (y + height)) < SNAP_THRESHOLD) {
      newBounds.y = y + height - newBounds.height;
    }

    mainWindow.setBounds(newBounds);
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // If the window itself is trying to open a popup, we generally block/externalize it.
    // However, for a "Browser" feature, users might want to click "Open in new tab" (which we don't support yet)
    // or the site might open a popup.
    // For V1, we stick to: New Windows -> Default System Browser.
    // This keeps the "Floating Window" clean.
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Global Shortcut to toggle visibility
  globalShortcut.register("CommandOrControl+Shift+A", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Global Shortcut for Context Send (Ctrl+Shift+C)
  globalShortcut.register("CommandOrControl+Shift+C", () => {
    console.log('Context Send hotkey triggered (Ctrl+Shift+C)');
    
    // Simulate Ctrl+C using WScript
    // -WindowStyle Hidden: Prevents PowerShell from stealing focus
    const copyCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^c')"`;
    
    exec(copyCommand, (error) => {
      if (error) {
        console.error('Failed to simulate Ctrl+C:', error);
      }
      
      // Wait for clipboard update
      setTimeout(() => {
        const clipboardText = clipboard.readText();
        console.log('Clipboard text:', clipboardText ? `${clipboardText.substring(0, 50)}...` : 'EMPTY');
        
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('context-send-triggered', clipboardText || '');
        }
      }, 300);
    });
  });

  // AI Switcher Hotkeys (Ctrl+1-9)
  const AI_HOTKEYS = [
    { key: '1', index: 0 },
    { key: '2', index: 1 },
    { key: '3', index: 2 },
    { key: '4', index: 3 },
    { key: '5', index: 4 },
    { key: '6', index: 5 },
    { key: '7', index: 6 },
    { key: '8', index: 7 },
    { key: '9', index: 8 }
  ];

  AI_HOTKEYS.forEach(({ key, index }) => {
    globalShortcut.register(`CommandOrControl+${key}`, () => {
      console.log(`AI Switcher: Ctrl+${key} pressed`);
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('switch-to-ai-index', index);
      }
    });
  });

  // Compare Mode Hotkey (Ctrl+Shift+M)
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('toggle-compare-mode');
    }
  });

  // Dock / Compact Mode Hotkey (Ctrl+Shift+D)
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow) {
      // Toggle compact mode via renderer
      mainWindow.webContents.send('toggle-compact-mode');
    }
  });
}

// DEEP-FIX: Disable automation flags that Google detects
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'AutomationControlled');

app.whenReady().then(() => {
  const { session } = require('electron');
  
  // FORCE-FIX: Google Login - Advanced Identity Spoofing
  // CRITICAL: Google checks for 'Client Hints' consistency.
  const aiSession = session.fromPartition("persist:ai_session");
  const filter = { urls: ['*://*/*'] };
  
  const modifyHeaders = (details, callback) => {
    // 1. Force Firefox User Agent
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0';
    
    // 2. REMOVE Client Hints (Firefox doesn't use the Chrome ones)
    // Sending Chrome hints with a Firefox UA is a major red flag for Google
    delete details.requestHeaders['sec-ch-ua'];
    delete details.requestHeaders['sec-ch-ua-mobile'];
    delete details.requestHeaders['sec-ch-ua-platform'];
    delete details.requestHeaders['Sec-Ch-Ua-Full-Version'];
    delete details.requestHeaders['Sec-Ch-Ua-Full-Version-List'];
    
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  };

  // Apply to both default and specific partition
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, modifyHeaders);
  aiSession.webRequest.onBeforeSendHeaders(filter, modifyHeaders);

  createWindow();

  // Check for updates on startup
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Initial update check failed:', err);
    });
  }, 3000); // Wait 3s after startup to not block initial load

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// IPC Listener for Always On Top
ipcMain.handle("toggle-always-on-top", (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

// IPC Listener to Clear Session Data
ipcMain.handle("clear-session-data", async () => {
  try {
    const { session } = require('electron');
    const aiSession = session.fromPartition("persist:ai_session");
    await aiSession.clearStorageData();
    return true;
  } catch (error) {
    console.error("Failed to clear session:", error);
    return false;
  }
});

// IPC Listener to Clear Specific AI Session
ipcMain.handle("clear-ai-session", async (event, aiUrl) => {
  try {
    const { session } = require('electron');
    const aiSession = session.fromPartition("persist:ai_session");
    const domain = new URL(aiUrl).hostname;
    await aiSession.clearStorageData({
      origin: `https://${domain}`
    });
    return true;
  } catch (error) {
    console.error("Failed to clear AI session:", error);
    return false;
  }
});

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

// IPC handler for clipboard access
ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

// Planning Board File Operations
ipcMain.handle('board-show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Planning Board',
    defaultPath: 'Untitled.board',
    filters: [
      { name: 'Planning Board Files', extensions: ['board'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('board-show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Planning Board',
    filters: [
      { name: 'Planning Board Files', extensions: ['board'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result;
});

ipcMain.handle('board-save-file', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving board file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('board-load-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const boardData = JSON.parse(data);
    return { success: true, data: boardData };
  } catch (error) {
    console.error('Error loading board file:', error);
    return { success: false, error: error.message };
  }
});

// Compact Mode (Bubble) handlers
let preCollapseBounds = null;

ipcMain.on('collapse-window', () => {
  if (!mainWindow) return;
  
  const isMaximized = mainWindow.isMaximized();
  preCollapseBounds = mainWindow.getBounds();
  
  if (isMaximized) {
    mainWindow.unmaximize();
  }
  
  // Remove minimum size constraints so it can shrink
  mainWindow.setMinimumSize(0, 0);
  
  // Resize to small bubble size (approx 220x100 to fit pill + frame overhead if any)
  mainWindow.setSize(220, 100, true);
  
  mainWindow.setAlwaysOnTop(true, 'screen-saver'); 
});

ipcMain.on('expand-window', () => {
  if (!mainWindow || !preCollapseBounds) return;
  
  // Restore size
  mainWindow.setBounds(preCollapseBounds, true);
  
  // Restore constraints after animation (short delay to prevent snapping glitch)
  setTimeout(() => {
    mainWindow.setMinimumSize(400, 500);
  }, 500);
});

// ============================================
// AI ACTION MODE REMOVED (Legacy Code Cleared)
// ============================================

// ============================================
// FILE CONVERT BACKEND HANDLERS
// ============================================

// Check LibreOffice Installation
ipcMain.handle('check-libreoffice', async () => {
  const libreOfficePaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ];
  
  for (const p of libreOfficePaths) {
    if (fs.existsSync(p)) {
      return { installed: true, path: p };
    }
  }
  
  return { installed: false };
});

// Open External URL
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Open external error:', error);
    return { success: false, error: error.message };
  }
});

// File Convert Handler
ipcMain.handle('convert-file', async (event, options) => {
  const { filePath, fileName, fileData, sourceFormat, targetFormat } = options;
  
  try {
    let inputPath = filePath;
    
    // If file data is provided instead of path, save it temporarily
    if (!inputPath && fileData && fileName) {
      const tempDir = app.getPath('temp');
      inputPath = path.join(tempDir, fileName);
      
      // Convert array back to Buffer and save
      const buffer = Buffer.from(fileData);
      fs.writeFileSync(inputPath, buffer);
    }
    
    // Validate inputs
    if (!inputPath || !sourceFormat || !targetFormat) {
      return { success: false, error: 'Missing required parameters' };
    }
    
    // Check if file exists
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: 'Source file not found' };
    }
    
    // Show save dialog
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Converted File',
      defaultPath: path.basename(inputPath, path.extname(inputPath)) + '.' + targetFormat,
      filters: [
        { name: getFilterName(targetFormat), extensions: [targetFormat] }
      ]
    });
    
    if (saveResult.canceled) {
      // Clean up temp file if it was created
      if (fileData && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      return { success: false, error: 'Save canceled' };
    }
    
    const outputPath = saveResult.filePath;
    
    // Convert using LibreOffice
    const result = await convertWithLibreOffice(inputPath, outputPath, sourceFormat, targetFormat);

    
    // Clean up temp file if it was created
    if (fileData && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    return result;
    
  } catch (error) {
    console.error('Conversion error:', error);
    return { success: false, error: error.message };
  }
});

// Helper: Convert file using LibreOffice
function convertWithLibreOffice(inputPath, outputPath, sourceFormat, targetFormat) {
  return new Promise((resolve, reject) => {
    // Determine LibreOffice executable path
    const libreOfficePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      '/usr/bin/libreoffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    ];
    
    let libreOfficePath = null;
    for (const p of libreOfficePaths) {
      if (fs.existsSync(p)) {
        libreOfficePath = p;
        break;
      }
    }
    
    if (!libreOfficePath) {
      return resolve({
        success: false,
        error: 'LibreOffice not found. Please install LibreOffice from https://www.libreoffice.org/'
      });
    }
    
    // Determine conversion filter based on source and target formats
    const outputDir = path.dirname(outputPath);
    let cmd;
    
    // PDF conversions require different handling
    if (sourceFormat === 'pdf' || sourceFormat.toLowerCase() === 'pdf') {
      // PDF to DOCX - use LibreOffice Writer with PDF import filter
      if (targetFormat === 'docx') {
        // Use Writer (swriter) to import PDF and export as DOCX
        // The key is using the correct application (swriter) instead of generic soffice
        const writerPath = libreOfficePath.replace('soffice.exe', 'swriter.exe');
        const useWriter = fs.existsSync(writerPath);
        
        if (useWriter) {
          // Use swriter for better PDF import support
          cmd = `"${writerPath}" --headless --convert-to docx --outdir "${outputDir}" "${inputPath}"`;
        } else {
          // Fallback: use soffice with explicit writer mode
          cmd = `"${libreOfficePath}" --headless --writer --convert-to docx --outdir "${outputDir}" "${inputPath}"`;
        }
      } else if (targetFormat === 'pptx') {
        // PDF to PPT - use draw
        cmd = `"${libreOfficePath}" --headless --convert-to pptx --outdir "${outputDir}" "${inputPath}"`;
      } else {
        return resolve({ success: false, error: 'Unsupported conversion from PDF' });
      }
    } else {
      // Other format conversions (DOCX/PPTX to PDF or to each other)
      const filterMap = {
        'pdf': 'writer_pdf_Export',
        'docx': 'MS Word 2007 XML',
        'pptx': 'Impress MS PowerPoint 2007 XML'
      };
      
      const filter = filterMap[targetFormat];
      if (!filter) {
        return resolve({ success: false, error: 'Unsupported target format' });
      }
      
      cmd = `"${libreOfficePath}" --headless --convert-to ${targetFormat}:"${filter}" --outdir "${outputDir}" "${inputPath}"`;
    }
    
    console.log('Executing conversion:', cmd);
    console.log('Input file:', inputPath);
    console.log('Output directory:', outputDir);
    console.log('Input file exists:', fs.existsSync(inputPath));
    
    // Execute conversion with increased timeout
    exec(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      console.log('LibreOffice stdout:', stdout);
      console.log('LibreOffice stderr:', stderr);
      
      if (error) {
        console.error('LibreOffice error:', error);
        
        // Provide helpful error message
        if (error.message.includes('timeout')) {
          return resolve({ success: false, error: 'Conversion timed out. The file may be too large or complex.' });
        }
        
        return resolve({ success: false, error: 'Conversion failed. LibreOffice may not support this PDF format. Try converting DOCX→PDF instead.' });
      }
      
      // Wait a moment for file system to sync
      setTimeout(() => {
        // Check if output file was created
        const expectedOutput = path.join(outputDir, path.basename(inputPath, path.extname(inputPath)) + '.' + targetFormat);
        
        console.log('Expected output:', expectedOutput);
        console.log('File exists:', fs.existsSync(expectedOutput));
        
        if (fs.existsSync(expectedOutput)) {
          // Rename to user's chosen name if different
          if (expectedOutput !== outputPath) {
            try {
              fs.renameSync(expectedOutput, outputPath);
              console.log('Renamed to:', outputPath);
            } catch (err) {
              console.error('Rename error:', err);
            }
          }
          
          resolve({ success: true, outputPath });
        } else {
          // List files in output directory for debugging
          const filesInDir = fs.readdirSync(outputDir);
          console.log('Files in output directory:', filesInDir);
          
          // Check if any file was created with similar name
          const baseName = path.basename(inputPath, path.extname(inputPath));
          const possibleFiles = filesInDir.filter(f => f.includes(baseName));
          console.log('Possible output files:', possibleFiles);
          
          resolve({ 
            success: false, 
            error: 'PDF to DOCX conversion is not supported by your LibreOffice installation. Please try converting DOCX→PDF instead, which works more reliably.' 
          });
        }
      }, 1000); // Wait 1 second for file system
    });
  });
}

// Helper: Get filter name for save dialog
function getFilterName(format) {
  const names = {
    'pdf': 'PDF Document',
    'docx': 'Word Document',
    'pptx': 'PowerPoint Presentation'
  };
  return names[format] || format.toUpperCase();
}



// ============================================
// SCREEN CAPTURE FOR PLANNING BOARD
// ============================================

let captureOverlayWindow = null;

function createCaptureWindow(dataUrl) {
    if (captureOverlayWindow) return; // Already exists

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { x, y, width, height } = display.bounds;

    captureOverlayWindow = new BrowserWindow({
        x, y, width, height,
        frame: false,
        transparent: true,
        fullscreen: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        webPreferences: {
            preload: path.join(__dirname, 'capture-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    captureOverlayWindow.loadFile('capture-overlay.html');

    captureOverlayWindow.webContents.on('did-finish-load', () => {
        captureOverlayWindow.webContents.send('capture-init', dataUrl);
    });

    captureOverlayWindow.on('closed', () => {
        captureOverlayWindow = null;
    });
}

ipcMain.on('start-capture-board', async () => {
    // 1. Hide main window to clear view
    if (mainWindow) mainWindow.hide();

    // 2. Capture Screen
    try {
        const cursor = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursor);
        
        // Calculate Physical Resolution
        const width = display.size.width * display.scaleFactor;
        const height = display.size.height * display.scaleFactor;

        const sources = await desktopCapturer.getSources({ 
            types: ['screen'], 
            thumbnailSize: { width, height }
        });
        
        // Find the source for the current display
        const source = sources.find(s => s.display_id == display.id) || sources[0];
        const dataUrl = source.thumbnail.toDataURL();

        // 3. Open Overlay
        setTimeout(() => {
            createCaptureWindow(dataUrl);
        }, 100);

    } catch (e) {
        console.error("Capture failed:", e);
        if (mainWindow) mainWindow.show();
    }
});

ipcMain.on('capture-complete', (event, dataUrl) => {
    if (captureOverlayWindow) captureOverlayWindow.close();
    
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('board-insert-image', dataUrl);
    }
});

ipcMain.on('capture-cancel', () => {
    if (captureOverlayWindow) captureOverlayWindow.close();
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});

// ============================================
// AUTO UPDATER (PUSH UPDATES)
// ============================================

const { autoUpdater } = require("electron-updater");

// Configure autoUpdater
autoUpdater.autoDownload = false; // User wants manual control
autoUpdater.allowPrerelease = true;
autoUpdater.logger = console;
autoUpdater.forceDevUpdateConfig = true;

// Helper to clear cache
function clearUpdateCache() {
    try {
        const pendingPath = path.join(app.getPath('userData'), 'pending');
        if (fs.existsSync(pendingPath)) {
            console.log('[Main] Clearing pending update cache:', pendingPath);
            fs.rmSync(pendingPath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('[Main] Failed to clear update cache:', e);
    }
}

// Clear cache on startup/init
clearUpdateCache();

ipcMain.handle('start-download-update', async () => {
  console.log('[Main] Manual download requested...');
  let result = await autoUpdater.downloadUpdate();
  
  // WORKAROUND: If downloadUpdate() returns null (common issue), 
  // we force a re-check with autoDownload=true to trigger it.
  if (!result) {
      console.log('[Main] downloadUpdate() returned null. Forcing auto-download via re-check...');
      autoUpdater.autoDownload = true;
      result = await autoUpdater.checkForUpdates();
      // Keep autoDownload = true for the duration of this session to ensure streams don't break
      // autoUpdater.autoDownload = false; 
  }
  return result;
});
autoUpdater.logger = console;
autoUpdater.forceDevUpdateConfig = true;

// Force Dev Configuration
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'ankit3890',
        repo: 'AI-Floating-Assistant'
    });
}

// Handle update events
autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', { 
        ...info, 
        currentVersion: app.getVersion() 
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('[Main] Download Progress:', progressObj.percent); // Local log
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Main] Update Downloaded:', info); // Local log
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// IPC Handlers for Updates
ipcMain.handle('check-for-updates', async () => {
  try {
      const result = await autoUpdater.checkForUpdates();
      // If check is skipped (e.g. no config in dev), it returns null/undefined
      if (!result) {
          console.log('[Main] Update check returned null (likely skipped)');
          if (mainWindow) {
              // Fake a 'not available' so UI doesn't hang
              mainWindow.webContents.send('update-not-available', { 
                  version: 'Dev/Unknown',
                  currentVersion: app.getVersion()
              });
          }
      }
      return result;
  } catch (err) {
      console.error('[Main] Update check error:', err);
      // Let the renderer catch this
      throw err;
  }
});

// [REMOVED] Duplicate handler

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});
