// lógica de auto-update para build instalada
const { autoUpdater } = require('electron-updater');
const log             = require('electron-log');
const { t }           = require('../i18n');

function setupInstalledUpdater(send) {
  autoUpdater.on('checking-for-update', () =>
    send('update-checking', { message: t('checkingUpdates') })
  );
  autoUpdater.on('update-available', info =>
    log.info(`update-available: v${info.version}`)
  );
  autoUpdater.on('update-not-available', () =>
    log.info('update-not-available')
  );
  autoUpdater.on('error', err => {
    const msg = err.message.includes('403')
      ? 'Erro no auto-updater: acesso negado (403).'
      : t('updateError', err.message);
    send('update-error', { message: msg });
  });
  autoUpdater.on('download-progress', p => {
    const pct = Math.round(p.percent);
    const kb  = Math.round(p.bytesPerSecond / 1024);
    send('download-progress', {
      message: t('downloading', pct, kb),
      percent: pct,
      speed: kb
    });
  });
  autoUpdater.on('update-downloaded', () =>
    send('update-downloaded', { message: t('downloaded') })
  );

  return {
    check: () => autoUpdater.checkForUpdatesAndNotify(),
    quitAndInstall: () => autoUpdater.quitAndInstall()
  };
}

module.exports = { setupInstalledUpdater };
