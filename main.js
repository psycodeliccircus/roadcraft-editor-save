// main.js
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const axios = require('axios');
const log = require('electron-log');
const { spawn } = require('child_process');
const { decodeFile, encodeFile } = require('./utils');

let mainWindow;
let autoUpdater; // apenas usado na build instalada

// Configuração do electron-log
log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs/main.log');
log.transports.file.level = 'info';
log.info('Aplicação iniciando...');

// ===== CONFIGURAÇÃO DO REPOSITÓRIO =====
const GITHUB_OWNER = 'psycodeliccircus';
const GITHUB_REPO  = 'roadcraft-editor-save';

// Nome fixo do executável portátil (o que existe na pasta portátil)
const PORTABLE_EXE_NAME = 'roadcraft-editor-save-win-portable.exe';

// Variável global para armazenar o caminho temporário do download concluído
let tmpDownloadedExePath = null;

// ===== Traduções =====
const translations = {
  'pt-BR': {
    checkingUpdates:    'Verificando atualizações...',
    downloading:        (pct, kb) => `Baixando: ${pct}% (${kb} KB/s)`,
    downloaded:         'Download concluído. Clique em Reiniciar para aplicar.',
    dialogTitle:        'Roadcraft Editor',
    saveSuccess:        'Arquivo salvo com sucesso!',
    invalidPath:        'Caminho de arquivo original inválido.',
    updateError:        erro => `Erro no auto-updater: ${erro}`
  },
  'en-EN': {
    checkingUpdates:    'Checking for updates...',
    downloading:        (pct, kb) => `Downloading: ${pct}% (${kb} KB/s)`,
    downloaded:         'Download complete. Click Restart to apply.',
    dialogTitle:        'Roadcraft Editor',
    saveSuccess:        'File saved successfully!',
    invalidPath:        'Invalid original file path.',
    updateError:        err => `Auto-updater error: ${err}`
  }
};

let lang;

// Detecta se este executável é a build portátil
function isPortableBuild() {
  return !!process.env.PORTABLE_EXECUTABLE_DIR;
}

// Se não for portátil, configura o autoUpdater (build instalada)
if (!isPortableBuild()) {
  const { autoUpdater: au } = require('electron-updater');
  autoUpdater = au;

  log.info('Build instalada detectada; configurando autoUpdater...');
  autoUpdater.on('checking-for-update', () => {
    log.info('autoUpdater: verificando atualização instalada...');
    send('update-checking', { message: translations[lang].checkingUpdates });
  });
  autoUpdater.on('update-not-available', () => {
    log.info('autoUpdater: nenhuma atualização encontrada para instalador');
  });
  autoUpdater.on('update-available', info => {
    log.info(`autoUpdater: atualização disponível (v${info.version}), iniciando download...`);
  });
  autoUpdater.on('error', err => {
    log.error('autoUpdater error:', err);
    const msg = err.message && err.message.includes('403')
      ? 'Erro no auto-updater: acesso negado (403).'
      : translations[lang].updateError(err.message || err);
    send('update-error', { message: msg });
  });
  autoUpdater.on('download-progress', p => {
    const pct = Math.round(p.percent);
    const kb  = Math.round(p.bytesPerSecond / 1024);
    log.info(`autoUpdater: progresso do instalador — ${pct}% (${kb} KB/s)`);
    send('download-progress', {
      message: translations[lang].downloading(pct, kb),
      percent: pct,
      speed: kb
    });
  });
  autoUpdater.on('update-downloaded', () => {
    log.info('autoUpdater: instalador baixado. Pronto para reiniciar.');
    send('update-downloaded', { message: translations[lang].downloaded });
  });
}

// Criação da janela principal
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
  if (mainWindow) {
    mainWindow.webContents.send(channel, payload);
  }
}

// ===== Fluxo de atualização PORTÁTIL via HEAD /releases/latest =====
async function checkPortableUpdate() {
  log.info('checkPortableUpdate() iniciado (build portátil)...');
  try {
    // 1) HEAD para obter redirect da última tag
    const latestUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    log.info(`Requisição HEAD em ${latestUrl}`);
    const redirectResp = await axios.get(latestUrl, {
      maxRedirects: 0,
      validateStatus: status => status === 302,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const location = redirectResp.headers.location; // ex: "/owner/repo/releases/tag/1.0.7"
    log.info(`Recebido redirect para: ${location}`);
    const latestTag = location.split('/').pop(); // ex: "1.0.7" ou "v1.0.7"
    const normalizedTag = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
    log.info(`Tag mais recente detectada: ${normalizedTag}`);

    const currentVersion = app.getVersion();
    log.info(`Versão atual do app: ${currentVersion}`);

    // Se a versão for a mesma, nada a fazer
    if (normalizedTag === currentVersion) {
      log.info('Portable: já está na última versão; sem ação.');
      return;
    }

    // 2) Monta a URL para o executável portátil
    const downloadUrl =
      `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${normalizedTag}/${PORTABLE_EXE_NAME}`;
    log.info(`Portable: URL montada para download → ${downloadUrl}`);

    // 3) Testa via HEAD se o arquivo realmente existe (200 OK)
    try {
      log.info(`Verificando existência com HEAD: ${downloadUrl}`);
      await axios.head(downloadUrl, {
        validateStatus: status => status < 400,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      log.info(`HEAD retornou OK; arquivo existe.`);
    } catch (headErr) {
      log.warn(`Portable: HEAD retornou erro/404; não há executável em ${downloadUrl}`);
      return;
    }

    // 4) Se existir, envia evento para o renderer
    const message = `Nova versão (${normalizedTag}) disponível.`;
    log.info(`Enviando evento 'portable-update-available': ${message}`);
    send('portable-update-available', {
      message,
      downloadUrl
    });
  } catch (err) {
    log.error('Erro em checkPortableUpdate():', err);
    const msg = (err.response && err.response.status === 403)
      ? 'Erro ao checar atualização portátil: acesso negado (403).'
      : translations[lang].updateError(err.message || err);
    send('update-error', { message: msg });
  }
}

// Faz apenas o download para um arquivo temporário,
// mas NÃO substitui o executável principal ainda.
async function downloadPortableToTemp(downloadUrl) {
  log.info(`downloadPortableToTemp() iniciado para: ${downloadUrl}`);
  try {
    // 1) Cria pasta temporária
    const tmpDir      = fs.mkdtempSync(path.join(os.tmpdir(), 'update-'));
    const tmpFileName = path.basename(downloadUrl); // ex: "roadcraft-editor-save-win-portable.exe"
    const tmpFilePath = path.join(tmpDir, tmpFileName);
    const writer      = fs.createWriteStream(tmpFilePath);
    log.info(`Diretório temporário criado: ${tmpDir}`);

    // 2) Baixar em stream
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
    log.info(`Tamanho total do download (bytes): ${totalBytes}`);

    let downloaded = 0;
    let lastTime   = Date.now();
    let lastBytes  = 0;

    response.data.on('data', chunk => {
      downloaded += chunk.length;
      const percent = totalBytes
        ? Math.round((downloaded / totalBytes) * 100)
        : 0;
      const now       = Date.now();
      const deltaTime = (now - lastTime) / 1000; // segundos
      const deltaBytes= downloaded - lastBytes;
      const kbps      = Math.round((deltaBytes / 1024) / (deltaTime || 1));

      log.info(`Portable download progresso: ${percent}% (${kbps} KB/s)`);
      send('portable-download-progress', {
        percent,
        kb: kbps
      });

      lastTime  = now;
      lastBytes = downloaded;
    });

    response.data.pipe(writer);

    // 3) Aguarda gravação terminar
    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        log.info('Portable: download concluído no arquivo temporário.');
        resolve();
      });
      writer.on('error', err => {
        log.error('Portable: erro ao gravar arquivo temporário:', err);
        reject(err);
      });
    });

    // 4) Armazena em variável global para uso depois, quando o usuário clicar “Reiniciar”
    tmpDownloadedExePath = tmpFilePath;
    log.info(`Portable: arquivo temporário armazenado em: ${tmpDownloadedExePath}`);

    // 5) Notifica o renderer de que o download foi concluído
    send('portable-download-complete', {
      message: translations[lang].downloaded
    });
  } catch (err) {
    log.error('Erro em downloadPortableToTemp():', err);
    send('update-error', { message: translations[lang].updateError(err.message || err) });
  }
}

// Quando o usuário clicar em “Reiniciar” no renderer,
// vamos criar um script Batch que aguardará o app encerrar e substituirá o exe na pasta real,
// depois relançará o novo executável.
async function replaceAndRestartPortable() {
  if (!tmpDownloadedExePath) {
    log.warn('replaceAndRestartPortable(): nenhum arquivo temporário encontrado.');
    return;
  }

  try {
    // 1) Descobrir a pasta onde o .exe portátil real está guardado
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
    if (!portableDir) {
      log.error('replaceAndRestartPortable(): não encontrou process.env.PORTABLE_EXECUTABLE_DIR');
      return;
    }

    // 2) Caminhos do executável real e do executável temporário
    const realExePath = path.join(portableDir, PORTABLE_EXE_NAME);
    const tempExePath = tmpDownloadedExePath;  // ex: "C:\Users\Pichau\AppData\Local\Temp\update-xxxx\roadcraft-editor-save-win-portable.exe"

    log.info(`replaceAndRestartPortable(): executável real: ${realExePath}`);
    log.info(`replaceAndRestartPortable(): executável temporário: ${tempExePath}`);

    // 3) Criar um arquivo BAT que:
    //    - Aguarda até que o executável real não esteja mais em uso
    //    - Renomeia o executável atual para backup
    //    - Copia o executável temporário para o local real
    //    - Inicia o novo executável
    const batContent = `
@echo off
setlocal

:: Caminhos usados
set "REAL_EXE=${realExePath}"
set "TEMP_EXE=${tempExePath}"

:waitloop
:: Tenta renomear; se falhar (código de erro != 0), aguarda 1 segundo e tenta de novo
rename "%REAL_EXE%" "%PORTABLE_EXE_NAME%.old" 2>nul
if errorlevel 1 (
  timeout /T 1 /NOBREAK >nul
  goto waitloop
)

:: Copiar novo exe
copy "%TEMP_EXE%" "%REAL_EXE%" >nul

:: Executar o novo exe
start "" "%REAL_EXE%"

endlocal
exit
`;

    // 4) Salvar o BAT em uma pasta temporária
    const batDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-bat-'));
    const batPath = path.join(batDir, 'update-portable.bat');
    fs.writeFileSync(batPath, batContent, 'utf8');
    log.info(`replaceAndRestartPortable(): arquivo BAT criado em: ${batPath}`);

    // 5) Executar o BAT de forma destacada (detached), para rodar após este processo sair
    spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    log.info('replaceAndRestartPortable(): BAT executado em modo detached');

    // 6) Fecha este app para liberar o arquivo real
    log.info('replaceAndRestartPortable(): encerrando este processo para liberar o EXE real...');
    app.exit(0);
  } catch (err) {
    log.error('replaceAndRestartPortable(): erro ao criar/executar BAT:', err);
    send('update-error', { message: translations[lang].updateError(err.message || err) });
  }
}

// Quando o app estiver pronto
app.whenReady().then(() => {
  const sysLocale = (app.getLocale() || 'en-US').toLowerCase();
  lang = sysLocale.startsWith('pt') ? 'pt-BR' : 'en-EN';
  log.info(`Locale detectado: ${sysLocale} → idioma selecionado: ${lang}`);

  createWindow();

  mainWindow.webContents.once('did-finish-load', () => {
    if (isPortableBuild()) {
      log.info('Build portátil detectada; iniciando checkPortableUpdate()');
      checkPortableUpdate();
    } else {
      log.info('Build instalada detectada; iniciando autoUpdater.checkForUpdatesAndNotify()');
      autoUpdater.checkForUpdatesAndNotify();
    }
  });
});

// IPC para baixar o portátil (clica em “Baixar” no renderer)
ipcMain.handle('portable-download', async (_, downloadUrl) => {
  log.info(`IPC recebido: portable-download → ${downloadUrl}`);
  await downloadPortableToTemp(downloadUrl);
});

// IPC para substituir o exe atual e reiniciar
ipcMain.handle('portable-replace-and-restart', async () => {
  log.info('IPC recebido: portable-replace-and-restart');
  await replaceAndRestartPortable();
});

// Outros handlers de IPC (abrir/guardar JSON etc.)
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

ipcMain.handle('get-asset-path', (_, name) => getAssetPath(name));
ipcMain.handle('restart-app', () => autoUpdater.quitAndInstall());
ipcMain.handle('set-lang', (_, newLang) => {
  if (translations[newLang]) {
    lang = newLang;
    log.info(`Idioma alterado para ${lang}`);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
