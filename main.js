// main.js
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const axios = require('axios');
const { decodeFile, encodeFile } = require('./utils');

let mainWindow;

// ===== CONFIGURAÇÃO DO REPOSITÓRIO GITHUB =====
// Substitua "seu-usuario" e "seu-repo" pelo seu usuário/organização e nome do repositório no GitHub.
// É nesse repo que você publica os assets: instalador (NSIS/Squirrel) e executável portable.
const GITHUB_OWNER = 'psycodeliccircus';
const GITHUB_REPO  = 'roadcraft-editor-save';

// ===== Traduções =====
const translations = {
  'pt-BR': {
    checkingUpdates:    'Verificando atualizações...',
    updateAvailable:    versão => `Versão ${versão} disponível. Iniciando download...`,
    updateNotAvailable: 'Nenhuma atualização encontrada.',
    updateError:        erro => `Erro no auto-updater: ${erro}`,
    downloading:        (pct, kb) => `Baixando: ${pct}% (${kb} KB/s)`,
    downloaded:         'Atualização baixada. Reinicie para aplicar.',
    dialogTitle:        'Roadcraft Editor',
    saveSuccess:        'Arquivo salvo com sucesso!',
    invalidPath:        'Caminho de arquivo original inválido.',
    updateQuestion:     versão => `Nova versão (${versão}) disponível. Deseja baixar agora?`,
    updateFail:         e => `Não foi possível aplicar a atualização: ${e}`,
    assetNotFound:      'Asset portátil não encontrado no release mais recente.'
  },
  'en-EN': {
    checkingUpdates:    'Checking for updates...',
    updateAvailable:    version => `Version ${version} available. Downloading...`,
    updateNotAvailable: 'No updates available.',
    updateError:        err => `Auto-updater error: ${err}`,
    downloading:        (pct, kb) => `Downloading: ${pct}% (${kb} KB/s)`,
    downloaded:         'Update downloaded. Restart to apply.',
    dialogTitle:        'Roadcraft Editor',
    saveSuccess:        'File saved successfully!',
    invalidPath:        'Invalid original file path.',
    updateQuestion:     version => `New version (${version}) available. Download now?`,
    updateFail:         e => `Could not apply update: ${e}`,
    assetNotFound:      'Portable asset not found in latest release.'
  }
};

// ===== Locale e idioma =====
let lang;

// Quando o app ficar pronto, detecta locale e inicializa janela + verificadores de update
app.whenReady().then(() => {
  const sysLocale = (app.getLocale() || 'en-US').toLowerCase();
  console.log('Locale detectado pelo Electron:', sysLocale);
  lang = sysLocale.startsWith('pt') ? 'pt-BR' : 'en-EN';

  createWindow();

  // Se for build portátil, usamos checkPortableUpdate(); caso contrário, autoUpdater normal
  if (isPortableBuild()) {
    checkPortableUpdate();
  } else {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Função que detecta se este executável é a versão portátil
function isPortableBuild() {
  // Em builds instaladas, existe "resources/app.asar".
  // Na build portátil, esse arquivo costuma não existir.
  const asarPath = path.join(process.resourcesPath, 'app.asar');
  return !fs.existsSync(asarPath);
}

// ===== Criação da janela principal =====
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

// ===== Verificação de atualização para build portátil (GitHub Releases) =====
async function checkPortableUpdate() {
  try {
    // 1. Consulta a API de Releases do GitHub para obter o release mais recente
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const resp = await axios.get(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    const data = resp.data;
    // GitHub usa tag_name. Normalmente começa com 'v', ex: 'v1.2.3'. Ajustamos para comparar com app.getVersion()
    let latestVersion = data.tag_name;
    if (latestVersion.startsWith('v') || latestVersion.startsWith('V')) {
      latestVersion = latestVersion.slice(1);
    }

    const currentVersion = app.getVersion();
    if (latestVersion !== currentVersion) {
      // 2. Procura o asset que representa a versão portátil (nome contendo "portable" ou extensão .exe/.zip)
      const asset = data.assets.find(a => {
        const lower = a.name.toLowerCase();
        return (lower.includes('portable') && (lower.endsWith('.exe') || lower.endsWith('.zip')));
      });

      if (!asset) {
        console.error('Asset portátil não encontrado no release mais recente.');
        dialog.showErrorBox(
          translations[lang].dialogTitle,
          translations[lang].assetNotFound
        );
        return;
      }

      // 3. Pergunta ao usuário se quer baixar a atualização
      const downloadUrl = asset.browser_download_url;
      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Atualizar agora', 'Mais tarde'],
        defaultId: 0,
        cancelId: 1,
        title: translations[lang].dialogTitle,
        message: translations[lang].updateQuestion(latestVersion)
      });
      if (result === 0) {
        await downloadAndReplace(downloadUrl);
      }
    } else {
      // Já está na última versão (opcional notificar)
      send('update-not-available', { message: translations[lang].updateNotAvailable });
    }
  } catch (err) {
    console.error('Erro ao checar atualização portátil:', err);
    // Evita notificar o usuário a todo instante; apenas logamos o erro.
  }
}

async function downloadAndReplace(downloadUrl) {
  try {
    // Baixa o arquivo (ZIP ou EXE) para uma pasta temporária
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-'));
    const tmpFileName = path.basename(downloadUrl);
    const tmpFile = path.join(tmpDir, tmpFileName);
    const writer = fs.createWriteStream(tmpFile);

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream'
    });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const execPath = process.execPath; // caminho do exe portátil atual
    // Faz backup do executável atual e substitui pelo novo download
    const backupPath = execPath + '.old';
    fs.renameSync(execPath, backupPath);
    fs.copyFileSync(tmpFile, execPath);

    // Remove arquivos temporários
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Reinicia a aplicação
    app.relaunch();
    app.exit(0);
  } catch (e) {
    dialog.showErrorBox(
      translations[lang].dialogTitle,
      translations[lang].updateFail(e)
    );
  }
}

// ===== Eventos do autoUpdater (versão instalada) =====
autoUpdater.on('checking-for-update', () => {
  send('update-checking', { message: translations[lang].checkingUpdates });
});
autoUpdater.on('update-available', info => {
  send('update-available', { message: translations[lang].updateAvailable(info.version) });
});
autoUpdater.on('update-not-available', () => {
  send('update-not-available', { message: translations[lang].updateNotAvailable });
});
autoUpdater.on('error', err => {
  send('update-error', { message: translations[lang].updateError(err.message) });
});
autoUpdater.on('download-progress', p => {
  const pct = Math.round(p.percent);
  const kb  = Math.round(p.bytesPerSecond / 1024);
  send('download-progress', {
    message: translations[lang].downloading(pct, kb),
    percent: pct,
    speed: kb
  });
});
autoUpdater.on('update-downloaded', () => {
  send('update-downloaded', { message: translations[lang].downloaded });
});

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

// ===== Trocar idioma em runtime =====
ipcMain.handle('set-lang', (_, newLang) => {
  if (translations[newLang]) {
    lang = newLang;
    console.log('Idioma alterado para:', lang);
  }
});

// ===== Eventos globais do aplicativo =====
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
