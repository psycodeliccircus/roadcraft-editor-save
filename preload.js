// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Abertura e salvamento de arquivos
  openFile:        () => ipcRenderer.invoke('open-file'),
  loadJson:        filePath => ipcRenderer.invoke('load-json', filePath),
  saveJson:        (filePath, base64, jsonData) => ipcRenderer.invoke('save-json', filePath, base64, jsonData),
  getAssetPath:    fileName => ipcRenderer.invoke('get-asset-path', fileName),

  // Reiniciar a aplicação para aplicar instalador (build instalada)
  restartApp:      () => ipcRenderer.invoke('restart-app'),

  // Eventos do auto-updater (build instalada)
  onUpdateChecking:     callback => ipcRenderer.on('update-checking',      (_, data) => callback(data)),
  onDownloadProgress:   callback => ipcRenderer.on('download-progress',    (_, data) => callback(data)),
  onUpdateDownloaded:   callback => ipcRenderer.on('update-downloaded',    (_, data) => callback(data)),
  onUpdateError:        callback => ipcRenderer.on('update-error',         (_, data) => callback(data)),

  // Eventos do download portátil
  onPortableUpdateAvailable: callback =>
    ipcRenderer.on('portable-update-available', (_, data) => callback(data)),
  onPortableDownloadProgress: callback =>
    ipcRenderer.on('portable-download-progress', (_, data) => callback(data)),
  onPortableDownloadComplete: callback =>
    ipcRenderer.on('portable-download-complete', (_, data) => callback(data)),

  // Métodos para instruir o main a baixar e a substituir
  portableDownload: downloadUrl => ipcRenderer.invoke('portable-download', downloadUrl),
  portableReplaceAndRestart: () => ipcRenderer.invoke('portable-replace-and-restart'),

  // Trocar idioma
  setLang:             lang => ipcRenderer.invoke('set-lang', lang)
});
