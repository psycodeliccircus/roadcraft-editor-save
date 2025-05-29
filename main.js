const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { decodeFile, encodeFile } = require('./utils');

let mainWindow;

function getAssetPath(fileName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build', fileName)
    : path.join(__dirname, 'build', fileName);
}

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  // assign to outer variable, not shadow
  mainWindow = new BrowserWindow({
    width:  Math.floor(sw * 0.9),
    height: Math.floor(sh * 0.9),
    minWidth: 800,
    minHeight: 600,
    icon: getAssetPath('icon.png'),
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');
}

function send(channel, payload) {
  if (mainWindow) {
    mainWindow.webContents.send(channel, payload);
  }
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Auto-updater events
autoUpdater.on('checking-for-update', () =>
  send('update-checking', { message: 'Verificando atualizações...' })
);
autoUpdater.on('update-available', info =>
  send('update-available', { message: `Versão ${info.version} disponível. Iniciando download...` })
);
autoUpdater.on('update-not-available', () =>
  send('update-not-available', { message: 'Nenhuma atualização encontrada.' })
);
autoUpdater.on('error', err =>
  send('update-error', { message: `Erro no auto-updater: ${err?.message ?? 'desconhecido'}` })
);
autoUpdater.on('download-progress', progress => {
  const percent = Math.round(progress.percent);
  const speed = Math.round(progress.bytesPerSecond / 1024);
  send('download-progress', { percent, speed });
});
autoUpdater.on('update-downloaded', async () => {
  send('update-downloaded', { message: 'Atualização baixada. Reinicie para aplicar.' });
});

// IPC handlers
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Selecione o CompleteSave',
    filters: [{ name: 'CompleteSave', extensions: ['*'] }],
    properties: ['openFile']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('load-json', async (_, filePath) => {
  const { content, decompressed } = decodeFile(filePath);
  const json = JSON.parse(decompressed.toString('utf8'));
  return { content: content.toString('base64'), json };
});

ipcMain.handle('save-json', async (_, originalPath, contentBase64, jsonData) => {
  const backupPath = `${originalPath}.bak`;
  fs.copyFileSync(originalPath, backupPath);

  const originalBuf  = Buffer.from(contentBase64, 'base64');
  const decompressed = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf8');
  encodeFile(originalBuf, decompressed, originalPath);

  await dialog.showMessageBox(mainWindow, {
    type: 'info', buttons: ['OK'],
    title: 'Roadcraft Editor',
    message: 'Arquivo salvo com sucesso!'
  });

  return { savedPath: originalPath, backupPath };
});

ipcMain.handle('get-asset-path', (_, fileName) => {
  return getAssetPath(fileName);
});
