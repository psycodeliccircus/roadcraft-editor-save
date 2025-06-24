// src/ipc-handlers.js
const { dialog, app } = require('electron');
const fs               = require('fs');
const path             = require('path');
const { decodeFile, encodeFile } = require('./utils');
const { t }            = require('./i18n');

module.exports = function registerIpc(ipcMain, mainWindow) {
  ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CompleteSave', extensions: ['*'] }]
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('load-json', async (_, filePath) => {
    const { content, decompressed } = decodeFile(filePath);
    return {
      content: content.toString('base64'),
      json: JSON.parse(decompressed.toString('utf8'))
    };
  });

  ipcMain.handle('save-json', async (_, originalPath, base64, jsonData) => {
    if (!originalPath) throw new Error(t('invalidPath'));
    const backupPath = `${originalPath}.bak`;
    fs.copyFileSync(originalPath, backupPath);
    const originalBuf  = Buffer.from(base64, 'base64');
    const decompressed = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf8');
    encodeFile(originalBuf, decompressed, originalPath);
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['OK'],
      title: t('dialogTitle'),
      message: t('saveSuccess')
    });
    return { savedPath: originalPath, backupPath };
  });

  ipcMain.handle('set-lang', (_, newLang) => {
    require('./i18n').setLocale(newLang);
  });

  // Handler para expor os assets do build (dev: src/build; prod: resourcesPath/build)
  ipcMain.handle('get-asset-path', (_, name) => {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'build', name)
      : path.join(__dirname, 'build', name);
  });
};
