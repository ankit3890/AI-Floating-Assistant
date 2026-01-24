// main.js
const { app, session, ipcMain, clipboard, BrowserWindow } = require('electron');
const path = require('path');

const startupManager = require('./startup-manager');
const windowManager = require('./window-manager');
const autoUpdate = require('./auto-update');
const Store = require('./store');

// Init Store reference (initialized in app.ready)
let storeInstance = null;

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
