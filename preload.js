// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Abertura e salvamento de arquivos
  openFile:        () => ipcRenderer.invoke('open-file'),
  loadJson:        filePath => ipcRenderer.invoke('load-json', filePath),
  saveJson:        (filePath, base64, jsonData) => ipcRenderer.invoke('save-json', filePath, base64, jsonData),
  getAssetPath:    fileName => ipcRenderer.invoke('get-asset-path', fileName),

  // Reiniciar a aplicação para aplicar update
  restartApp:      () => ipcRenderer.invoke('restart-app'),

  // Eventos do auto-updater
  onUpdateChecking:     callback => ipcRenderer.on('update-checking',      (_, data) => callback(data)),
  onUpdateAvailable:    callback => ipcRenderer.on('update-available',     (_, data) => callback(data)),
  onUpdateNotAvailable: callback => ipcRenderer.on('update-not-available', (_, data) => callback(data)),
  onUpdateError:        callback => ipcRenderer.on('update-error',         (_, data) => callback(data)),
  onDownloadProgress:   callback => ipcRenderer.on('download-progress',    (_, data) => callback(data)),
  onUpdateDownloaded:   callback => ipcRenderer.on('update-downloaded',    (_, data) => callback(data)),

  // **Nova API para trocar idioma no Main**
  setLang:             lang => ipcRenderer.invoke('set-lang', lang)
});
