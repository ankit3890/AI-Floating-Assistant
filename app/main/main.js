// main.js
const { app, session, ipcMain, clipboard, BrowserWindow, shell } = require('electron');
const path = require('path');

const startupManager = require('./startup-manager');
const windowManager = require('./window-manager');
const autoUpdate = require('./auto-update');
const Store = require('./store');

// Init Store reference (initialized in app.ready)
let storeInstance = null;

// Store main window reference for OAuth callback
let mainWindowRef = null;

// ---------------------------------------------
// App Flags
// ---------------------------------------------
const isStartupLaunch = process.argv.includes('--startup');

console.log('--------------------------------------------------');
console.log('--- AI Floating Assistant v1.0.4 ---');
console.log('--------------------------------------------------');

// Reduce automation detection
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'AutomationControlled');

// ---------------------------------------------
// Custom Protocol Registration (OAuth Callback)
// ---------------------------------------------
const PROTOCOL_NAME = 'aifloatingassistant';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}

// Handle deep links (OAuth callback)
const handleDeepLink = (url) => {
  console.log('[Deep Link] Received:', url);
  
  if (!url.startsWith(`${PROTOCOL_NAME}://`)) return;
  
  try {
    const parsedUrl = new URL(url);
    const token = parsedUrl.searchParams.get('token');
    const error = parsedUrl.searchParams.get('error');
    
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      // Show and focus window
      if (mainWindowRef.isMinimized()) mainWindowRef.restore();
      mainWindowRef.show();
      mainWindowRef.focus();
      
      // Send auth result to renderer
      if (token) {
        console.log('[OAuth] Success - sending token to renderer');
        mainWindowRef.webContents.send('auth-success', token);
      } else if (error) {
        console.log('[OAuth] Error:', error);
        mainWindowRef.webContents.send('auth-error', error);
      }
    }
  } catch (err) {
    console.error('[Deep Link Error]', err);
  }
};

// macOS: Handle protocol from open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows: Handle protocol from second-instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Windows: commandLine includes the deep link URL
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://`));
    if (url) {
      handleDeepLink(url);
    }
    
    // Focus existing window
    if (mainWindowRef) {
      if (mainWindowRef.isMinimized()) mainWindowRef.restore();
      mainWindowRef.show();
      mainWindowRef.focus();
    }
  });
}

// ---------------------------------------------
// IPC: System
// ---------------------------------------------
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

// ---------------------------------------------
// IPC: Startup
// ---------------------------------------------
ipcMain.handle('get-startup-status', () => startupManager.isEnabled());
ipcMain.handle('toggle-startup', () => startupManager.toggle());

// ---------------------------------------------
// IPC: Session Management
// ---------------------------------------------
ipcMain.handle('clear-session-data', async () => {
  try {
    const aiSession = session.fromPartition('persist:ai_session_v2');
    await aiSession.clearStorageData();
    return true;
  } catch (err) {
    console.error('[Session Clear Error]', err);
    return false;
  }
});

ipcMain.handle('clear-ai-session', async (_, aiUrl) => {
  try {
    const aiSession = session.fromPartition('persist:ai_session_v2');
    const { hostname } = new URL(aiUrl);

    await aiSession.clearStorageData({
      origin: `https://${hostname}`
    });

    return true;
  } catch (err) {
    console.error('[AI Session Clear Error]', err);
    return false;
  }
});

// ---------------------------------------------
// IPC: Settings Store
// ---------------------------------------------
ipcMain.handle('settings-get', (_, key) => storeInstance ? storeInstance.get(key) : null);
ipcMain.handle('settings-set', (_, key, val) => storeInstance ? storeInstance.set(key, val) : null);

// ---------------------------------------------
// App Ready
// ---------------------------------------------

app.whenReady().then(() => {
  console.log('App Ready: Initializing services...');
  
  // Init Store safely after App Ready
  try {
      storeInstance = new Store({
        configName: 'user-settings',
        defaults: {
          userAIs: [],
          featureFlags: {}
        }
      });
      console.log('Store initialized at:', storeInstance.path);
  } catch (err) {
      console.error('Store init failed:', err);
  }

  startupManager.initialize();

  // -------- Header Spoofing (SCOPED & SAFE) --------
  const aiSession = session.fromPartition('persist:ai_session_v2');
  const filter = { urls: ['https://*.google.com/*', 'https://*.openai.com/*'] };


  const modifyHeaders = (details, callback) => {
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0';

    [
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'Sec-Ch-Ua-Full-Version',
      'Sec-Ch-Ua-Full-Version-List'
    ].forEach(h => delete details.requestHeaders[h]);

    callback({ requestHeaders: details.requestHeaders });
  };

  aiSession.webRequest.onBeforeSendHeaders(filter, modifyHeaders);

  // -------- Create Main Window --------
  const mainWindow = windowManager.createWindow(isStartupLaunch);
  mainWindowRef = mainWindow; // Store reference for OAuth callback

  // -------- Auto Update --------
  autoUpdate.setupAutoUpdater(mainWindow);

  // -------- macOS Reactivation --------
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow(false);
    }
  });
});

// ---------------------------------------------
// Quit Handling
// ---------------------------------------------
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
