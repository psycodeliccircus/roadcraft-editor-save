const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { decodeFile, encodeFile } = require('./utils');

let mainWindow;

function getAssetPath(fileName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', fileName);
  } else {
    return path.join(__dirname, 'build', fileName);
  }
}

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    width:  Math.floor(sw * 0.9),    // 90% da largura da tela
    height: Math.floor(sh * 0.9),    // 90% da altura da tela
    minWidth: 1024,                  // largura mínima
    minHeight: 768,                  // altura mínima
    icon: getAssetPath('icon.png'),
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // remove completamente o menu da aplicação
  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');
}

function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', text);
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
  sendStatusToWindow('Verificando atualizações...')
);
autoUpdater.on('update-available', () =>
  sendStatusToWindow('Atualização disponível. Baixando...')
);
autoUpdater.on('update-not-available', () =>
  sendStatusToWindow('Nenhuma atualização encontrada.')
);
autoUpdater.on('error', err =>
  sendStatusToWindow(`Erro no auto-updater: ${err?.message ?? 'desconhecido'}`)
);
autoUpdater.on('download-progress', progress => {
  const percent = Math.round(progress.percent);
  sendStatusToWindow(
    `Baixando: ${percent}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`
  );
});
autoUpdater.on('update-downloaded', async () => {
  sendStatusToWindow('Atualização baixada. Será instalada ao fechar.');
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['OK'],
    title: 'Roadcraft Editor',
    message: 'Nova versão baixada. Reinicie o app para aplicar a atualização.'
  });
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
    type: 'info',
    buttons: ['OK'],
    title: 'Roadcraft Editor',
    message: 'Arquivo salvo com sucesso!'
  });

  return { savedPath: originalPath, backupPath };
});
