const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke('toggle-always-on-top', flag),
  clearSessionData: () => ipcRenderer.invoke('clear-session-data'),
  clearAISession: (aiUrl) => ipcRenderer.invoke('clear-ai-session', aiUrl),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Context Send APIs
  onContextSendTriggered: (callback) => 
    ipcRenderer.on('context-send-triggered', (event, text) => callback(text)),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  
  // AI Switcher API
  onSwitchToAIIndex: (callback) =>
    ipcRenderer.on('switch-to-ai-index', (event, index) => callback(index)),
    
  // Compare Mode API
  onToggleCompareMode: (callback) =>
    ipcRenderer.on('toggle-compare-mode', () => callback()),

  // Compact Mode API
  collapseWindow: () => ipcRenderer.send('collapse-window'),
  expandWindow: () => ipcRenderer.send('expand-window'),
  onToggleCompactMode: (callback) => ipcRenderer.on('toggle-compact-mode', () => callback()),

  // AI Action Mode API
  executeAIAction: (target, instruction) => ipcRenderer.invoke('execute-ai-action', { target, instruction }),
  confirmAIAction: (target, plan) => ipcRenderer.invoke('confirm-ai-action', { target, plan }),
  
  // Planning Board File Operations
  boardShowSaveDialog: () => ipcRenderer.invoke('board-show-save-dialog'),
  boardShowOpenDialog: () => ipcRenderer.invoke('board-show-open-dialog'),
  boardSaveFile: (filePath, data) => ipcRenderer.invoke('board-save-file', filePath, data),
  boardLoadFile: (filePath) => ipcRenderer.invoke('board-load-file', filePath),
  
  // File Convert API
  convertFile: (options) => ipcRenderer.invoke('convert-file', options),
  checkLibreOffice: () => ipcRenderer.invoke('check-libreoffice'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  

  // Screen Capture (Board) API
  startCaptureBoard: () => ipcRenderer.send('start-capture-board'),
  onBoardInsertImage: (callback) => ipcRenderer.on('board-insert-image', (event, dataUrl) => callback(dataUrl)),

  // Screen Drawing Overlay API
  startScreenDrawing: () => ipcRenderer.send('start-screen-drawing'),

  // Update API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  startDownloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  // Update Listeners
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, err) => callback(err)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),

});

// Also expose as window.electron for backward compatibility
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    const validChannels = [
      'board-show-save-dialog',
      'board-show-open-dialog', 
      'board-save-file',
      'board-load-file'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  }
});
