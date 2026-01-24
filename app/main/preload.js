// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Utility to safely subscribe/unsubscribe
const subscribe = (channel, callback) => {
  const handler = (_, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('electronAPI', {
  // ---------------- System ----------------
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),

  // ---------------- Startup ----------------
  getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
  toggleStartup: () => ipcRenderer.invoke('toggle-startup'),

  // ---------------- Session ----------------
  clearSessionData: () => ipcRenderer.invoke('clear-session-data'),
  clearAISession: (url) => ipcRenderer.invoke('clear-ai-session', url),

  // ---------------- Settings ----------------
  settingsGet: (key) => ipcRenderer.invoke('settings-get', key),
  settingsSet: (key, val) => ipcRenderer.invoke('settings-set', key, val),

  // ---------------- Window ----------------
  toggleAlwaysOnTop: (flag) =>
    ipcRenderer.invoke('toggle-always-on-top', Boolean(flag)),

  collapseWindow: () => ipcRenderer.send('collapse-window'),
  expandWindow: () => ipcRenderer.send('expand-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),

  // ---------------- AI ----------------
  executeAIAction: (target, instruction) =>
    ipcRenderer.invoke('execute-ai-action', { target, instruction }),

  confirmAIAction: (target, plan) =>
    ipcRenderer.invoke('confirm-ai-action', { target, plan }),

  // ---------------- Board ----------------
  boardShowSaveDialog: () => ipcRenderer.invoke('board-show-save-dialog'),
  boardShowOpenDialog: () => ipcRenderer.invoke('board-show-open-dialog'),
  boardSaveFile: (filePath, data) =>
    ipcRenderer.invoke('board-save-file', filePath, data),
  boardLoadFile: (filePath) =>
    ipcRenderer.invoke('board-load-file', filePath),

  // ---------------- Convert ----------------
  convertFile: (options) => ipcRenderer.invoke('convert-file', options),
  checkLibreOffice: () => ipcRenderer.invoke('check-libreoffice'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ---------------- Capture ----------------
  startCaptureBoard: () => ipcRenderer.send('start-capture-board'),
  startScreenDrawing: () => ipcRenderer.send('start-screen-drawing'),
  openScreenDrawing: () => ipcRenderer.invoke('open-screen-drawing'),

  // ---------------- Updates ----------------
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  startDownloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),

  // ---------------- Listeners (auto cleanup) ----------------
  onUpdateAvailable: (cb) => subscribe('update-available', cb),
  onUpdateNotAvailable: (cb) => subscribe('update-not-available', cb),
  onUpdateError: (cb) => subscribe('update-error', cb),
  onDownloadProgress: (cb) => subscribe('download-progress', cb),
  onUpdateDownloaded: (cb) => subscribe('update-downloaded', cb),

  onContextSendTriggered: (cb) => subscribe('context-send-triggered', cb),
  onSwitchToAIIndex: (cb) => subscribe('switch-to-ai-index', cb),
  onToggleCompareMode: (cb) => subscribe('toggle-compare-mode', cb),
  onToggleCompactMode: (cb) => subscribe('toggle-compact-mode', cb),
  onBoardInsertImage: (cb) => subscribe('board-insert-image', cb),
});

contextBridge.exposeInMainWorld('drawingAPI', {
    exit: () => ipcRenderer.send('draw-exit')
});

// Legacy minimal API
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    const allowed = [
      'board-show-save-dialog',
      'board-show-open-dialog',
      'board-save-file',
      'board-load-file'
    ];
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  }
});
