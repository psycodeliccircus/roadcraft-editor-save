// lógica de update para build portátil
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
const { spawn }  = require('child_process');
const log        = require('electron-log');
const {
  GITHUB_OWNER, GITHUB_REPO,
  PORTABLE_EXE_NAME, TMP_DIR_PREFIX, BAT_DIR_PREFIX
} = require('../config');
const { t }      = require('../i18n');

let tmpDownloadedExePath = '';

async function checkPortableUpdate(send, currentVersion) {
  const latestUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const redirect = await axios.get(latestUrl, {
    maxRedirects: 0,
    validateStatus: s => s === 302
  });
  const tag = redirect.headers.location.split('/').pop().replace(/^v/, '');
  if (tag === currentVersion) return;

  const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tag}/${PORTABLE_EXE_NAME}`;
  try {
    await axios.head(downloadUrl, { validateStatus: s => s < 400 });
    send('portable-update-available', {
      message: `Nova versão (${tag}) disponível.`,
      downloadUrl
    });
  } catch {
    log.warn('Portable: executável não encontrado');
  }
}

async function downloadPortableToTemp(send, downloadUrl) {
  const tmpDir      = fs.mkdtempSync(TMP_DIR_PREFIX);
  const tmpFilePath = path.join(tmpDir, PORTABLE_EXE_NAME);
  const writer      = fs.createWriteStream(tmpFilePath);
  const resp        = await axios.get(downloadUrl, { responseType: 'stream' });
  const totalBytes  = +resp.headers['content-length'] || 0;
  let downloaded    = 0;
  let lastTime = Date.now(), lastBytes = 0;

  resp.data.on('data', chunk => {
    downloaded += chunk.length;
    const pct = totalBytes ? Math.round(downloaded/totalBytes*100) : 0;
    const now = Date.now();
    const kb  = Math.round((downloaded - lastBytes)/(1024 * ((now-lastTime)/1000) || 1));
    send('portable-download-progress', { percent: pct, kb });
    lastTime = now; lastBytes = downloaded;
  });

  resp.data.pipe(writer);
  await new Promise((res, rej) => writer.on('finish', res).on('error', rej));

  tmpDownloadedExePath = tmpFilePath;
  send('portable-download-complete', { message: t('downloaded') });
}

async function replaceAndRestartPortable(send) {
  if (!tmpDownloadedExePath) return;
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  const realExe     = path.join(portableDir, PORTABLE_EXE_NAME);
  const batDir      = fs.mkdtempSync(BAT_DIR_PREFIX);
  const batPath     = path.join(batDir, 'update-portable.bat');

  const bat = `
@echo off
set REAL_EXE=${realExe}
set TEMP_EXE=${tmpDownloadedExePath}
:loop
rename "%REAL_EXE%" "${PORTABLE_EXE_NAME}.old" 2>nul || (
  timeout /T 1 >nul
  goto loop
)
copy "%TEMP_EXE%" "%REAL_EXE%" >nul
start "" "%REAL_EXE%"
exit
`;
  fs.writeFileSync(batPath, bat, 'utf8');
  spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore' }).unref();
  send('portable-restart');
}

module.exports = {
  checkPortableUpdate,
  downloadPortableToTemp,
  replaceAndRestartPortable
};
