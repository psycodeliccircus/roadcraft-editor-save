const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:     () => ipcRenderer.invoke('open-file'),
  loadJson:     (filePath) => ipcRenderer.invoke('load-json', filePath),
  saveJson:     (path, content, json) => ipcRenderer.invoke('save-json', path, content, json),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, message) => callback(message))
});
