// ponto de entrada principal
const path               = require('path');
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const log                = require('electron-log');
const { setLocale, t }   = require('./i18n');
const config             = require('./config');
const registerIpc        = require('./ipc-handlers');
const { setupInstalledUpdater } = require('./updater/installed');
const {
  checkPortableUpdate,
  downloadPortableToTemp,
  replaceAndRestartPortable
} = require('./updater/portable');

// configurar logging
log.transports.file.resolvePath = () => config.LOG_PATH;
log.transports.file.level = 'info';
log.info('Aplicação iniciando...');

// tratar erros globais
process.on('unhandledRejection', err => log.error('UnhandledRejection', err));
process.on('uncaughtException',    err => {
  log.error('UncaughtException', err);
  app.exit(1);
});

let mainWindow;
let updater;

function send(channel, payload) {
  if (mainWindow) mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width:  Math.floor(width * 0.9),
    height: Math.floor(height * 0.9),
    minWidth:  800,
    minHeight: 600,
    icon:      path.join(app.isPackaged ? process.resourcesPath : __dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  setLocale(app.getLocale());
  createWindow();

  registerIpc(ipcMain, mainWindow);

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    checkPortableUpdate(send, app.getVersion());
    ipcMain.handle('portable-download', (_, url) => downloadPortableToTemp(send, url));
    ipcMain.handle('portable-replace', () => replaceAndRestartPortable(send));
  } else {
    updater = setupInstalledUpdater(send);
    updater.check();
    ipcMain.handle('restart-app', () => updater.quitAndInstall());
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
