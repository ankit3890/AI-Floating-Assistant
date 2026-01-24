// auto-update.js
const { autoUpdater } = require('electron-updater');
const { app, ipcMain } = require('electron');
const log = require('electron-log');

let mainWindow = null;
let initialized = false;
let downloadInProgress = false;

/* ---------------- Logger ---------------- */
log.transports.file.level = 'info';
autoUpdater.logger = log;

/* ---------------- Updater Config ---------------- */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;

/* ---------------- Setup ---------------- */
function setupAutoUpdater(window) {
  if (initialized) {
    log.warn('[Updater] Already initialized');
    return;
  }

  mainWindow = window;
  initialized = true;

  if (!app.isPackaged) {
    log.info('[Updater] Dev mode detected - enabling forceDevUpdateConfig');
    autoUpdater.forceDevUpdateConfig = true;
    // autoUpdater.allowDowngrade = true; // Optional: if testing downgrades
  }

  log.info('[Updater] Initializing');

  /* ---------- Events ---------- */

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] No update available');
    mainWindow?.webContents.send('update-not-available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Downloaded:', info.version);
    downloadInProgress = false;
    mainWindow?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err);
    downloadInProgress = false;
    mainWindow?.webContents.send(
      'update-error',
      err?.message || 'Update failed'
    );
  });

  /* ---------- Initial Silent Check ---------- */
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err =>
      log.error('[Updater] Initial check failed', err)
    );
  }, 3000);
}

/* ---------------- IPC ---------------- */

ipcMain.handle('check-for-updates', async () => {
  // Allow dev mode for testing if needed, or explicitly warn.
  if (!app.isPackaged) {
    log.info('[Updater] Dev mode: forcing update config for testing');
    autoUpdater.forceDevUpdateConfig = true;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    log.error('[Updater] Manual check failed', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-download-update', async () => {
  if (downloadInProgress) {
    return { success: false, error: 'Download already in progress' };
  }

  try {
    downloadInProgress = true;
    log.info('[Updater] Download started');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    downloadInProgress = false;
    log.error('[Updater] Download failed', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  log.info('[Updater] Quit & install requested');

  // Give renderer time to clean up
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
});

module.exports = {
  setupAutoUpdater
};
