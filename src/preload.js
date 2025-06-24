// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs and JSON I/O
  openFile: () => ipcRenderer.invoke('open-file'),
  loadJson: (filePath) => ipcRenderer.invoke('load-json', filePath),
  saveJson: (filePath, base64, jsonData) =>
    ipcRenderer.invoke('save-json', filePath, base64, jsonData),

  // Language setting
  setLang: (lang) => ipcRenderer.invoke('set-lang', lang),

  // Asset paths
  getAssetPath: (name) => ipcRenderer.invoke('get-asset-path', name),

  // Installed build auto-updater
  restartApp: () => ipcRenderer.invoke('restart-app'),
  onUpdateChecking: (cb) =>
    ipcRenderer.on('update-checking', (_, data) => cb(data)),
  onDownloadProgress: (cb) =>
    ipcRenderer.on('download-progress', (_, data) => cb(data)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update-downloaded', (_, data) => cb(data)),
  onUpdateError: (cb) =>
    ipcRenderer.on('update-error', (_, data) => cb(data)),

  // Portable build update
  portableDownload: (url) => ipcRenderer.invoke('portable-download', url),
  portableReplace: () => ipcRenderer.invoke('portable-replace'),
  onPortableUpdateAvailable: (cb) =>
    ipcRenderer.on('portable-update-available', (_, data) => cb(data)),
  onPortableDownloadProgress: (cb) =>
    ipcRenderer.on('portable-download-progress', (_, data) => cb(data)),
  onPortableDownloadComplete: (cb) =>
    ipcRenderer.on('portable-download-complete', (_, data) => cb(data))
});
