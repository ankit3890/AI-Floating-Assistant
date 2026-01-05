const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onShowCapture: (callback) => ipcRenderer.on('capture-init', (event, dataUrl) => callback(dataUrl)),
    completeCapture: (dataUrl) => ipcRenderer.send('capture-complete', dataUrl),
    cancelCapture: () => ipcRenderer.send('capture-cancel')
});
