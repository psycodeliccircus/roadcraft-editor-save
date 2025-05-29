const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:      () => ipcRenderer.invoke('open-file'),
  loadJson:      (p) => ipcRenderer.invoke('load-json', p),
  saveJson:      (p, c, j) => ipcRenderer.invoke('save-json', p, c, j),
  onUpdateStatus: cb => ipcRenderer.on('update-status', (_, msg) => cb(msg)),
  getAssetPath:  (fileName) => ipcRenderer.invoke('get-asset-path', fileName)
});
