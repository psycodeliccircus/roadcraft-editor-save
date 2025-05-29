// main.js
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');
const { decodeFile, encodeFile } = require('./utils');

let mainWindow;

// ===== Traduções =====
const translations = {
  'pt-BR': {
    checkingUpdates:   'Verificando atualizações...',
    updateAvailable:   versão => `Versão ${versão} disponível. Iniciando download...`,
    updateNotAvailable:'Nenhuma atualização encontrada.',
    updateError:       erro => `Erro no auto-updater: ${erro}`,
    downloading:       (pct, kb) => `Baixando: ${pct}% (${kb} KB/s)`,
    downloaded:        'Atualização baixada. Reinicie para aplicar.',
    dialogTitle:       'Roadcraft Editor',
    saveSuccess:       'Arquivo salvo com sucesso!',
    invalidPath:       'Caminho de arquivo original inválido.'
  },
  'en-EN': {
    checkingUpdates:   'Checking for updates...',
    updateAvailable:   version => `Version ${version} available. Downloading...`,
    updateNotAvailable:'No updates available.',
    updateError:       err => `Auto-updater error: ${err}`,
    downloading:       (pct, kb) => `Downloading: ${pct}% (${kb} KB/s)`,
    downloaded:        'Update downloaded. Restart to apply.',
    dialogTitle:       'Roadcraft Editor',
    saveSuccess:       'File saved successfully!',
    invalidPath:       'Invalid original file path.'
  }
};

// ===== Locale e idioma =====
// vamos declarar lang como `let` para podermos reatribuir dinamicamente
let lang;

// após o app estar pronto, detectamos o locale e inicializamos `lang`
app.whenReady().then(() => {
  const sysLocale = (app.getLocale() || 'en-US').toLowerCase();
  console.log('Locale detectado pelo Electron:', sysLocale);
  lang = sysLocale.startsWith('pt') ? 'pt-BR' : 'en-EN';
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

// handler para trocar o idioma em runtime (invocado do renderer)
ipcMain.handle('set-lang', (_, newLang) => {
  if (translations[newLang]) {
    lang = newLang;
    console.log('Idioma alterado para:', lang);
  }
});

function getAssetPath(fileName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build', fileName)
    : path.join(__dirname, 'build', fileName);
}

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
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
  if (mainWindow) mainWindow.webContents.send(channel, payload);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== Atualizações =====
autoUpdater.on('checking-for-update',   ()   => send('update-checking',      { message: translations[lang].checkingUpdates }));
autoUpdater.on('update-available',     info => send('update-available',    { message: translations[lang].updateAvailable(info.version) }));
autoUpdater.on('update-not-available',  ()   => send('update-not-available', { message: translations[lang].updateNotAvailable }));
autoUpdater.on('error',                err  => send('update-error',         { message: translations[lang].updateError(err.message) }));
autoUpdater.on('download-progress',    p    => {
  const pct = Math.round(p.percent);
  const kb  = Math.round(p.bytesPerSecond / 1024);
  send('download-progress', {
    message: translations[lang].downloading(pct, kb),
    percent: pct,
    speed: kb
  });
});
autoUpdater.on('update-downloaded',    ()   => send('update-downloaded',    { message: translations[lang].downloaded }));

// ===== Abrir arquivo =====
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'CompleteSave', extensions: ['*'] }]
  });
  return canceled ? null : filePaths[0];
});

// ===== Carregar JSON =====
ipcMain.handle('load-json', async (_, filePath) => {
  const { content, decompressed } = decodeFile(filePath);
  return {
    content: content.toString('base64'),
    json: JSON.parse(decompressed.toString('utf8'))
  };
});

// ===== Salvar JSON =====
ipcMain.handle('save-json', async (_, originalPath, base64, jsonData) => {
  if (!originalPath) {
    throw new Error(translations[lang].invalidPath);
  }

  const backupPath = `${originalPath}.bak`;
  fs.copyFileSync(originalPath, backupPath);

  const originalBuf  = Buffer.from(base64, 'base64');
  const decompressed = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf8');
  encodeFile(originalBuf, decompressed, originalPath);

  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['OK'],
    title: translations[lang].dialogTitle,
    message: translations[lang].saveSuccess
  });

  return { savedPath: originalPath, backupPath };
});

// ===== Path dinâmico e restart =====
ipcMain.handle('get-asset-path', (_, name) => getAssetPath(name));
ipcMain.handle('restart-app', () => autoUpdater.quitAndInstall());
