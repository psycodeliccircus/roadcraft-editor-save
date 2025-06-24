// src/renderer.js

(() => {
  // ===== Constants & State =====
  const translations = {
    'pt-BR': {
      title: 'Editor de Save Completo do Roadcraft',
      open: 'Abrir arquivo CompleteSave',
      save: 'Salvar arquivo',
      footer: '© 2025 Roadcraft Editor. Todos os direitos reservados.',
      editing: 'Editando arquivo: ',
      preparing: 'Preparando dados para salvar…',
      prepared: 'Dados preparados. Efetuando salvamento…',
      saved: 'Salvo em: ',
      backup: ' (backup em: ',
      failedOpen: 'Não foi possível abrir o arquivo',
      errorSave: 'Erro ao salvar o arquivo'
    },
    'en-EN': {
      title: 'Roadcraft Completesave Editor',
      open: 'Open CompleteSave',
      save: 'Save',
      footer: '© 2025 Roadcraft Editor. All rights reserved.',
      editing: 'Editing: ',
      preparing: 'Preparing data to save...',
      prepared: 'Data prepared. Saving...',
      saved: 'Saved to ',
      backup: ' (backup at ',
      failedOpen: 'Failed to open file',
      errorSave: 'Error saving file'
    }
  };

  const icons = {
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3 m15.364-6.364l-1.414 1.414 M6.05 17.95l-1.414 1.414 m12.728 0l-1.414-1.414 M6.05 6.05L4.636 7.464 M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
  };

  const UI = {
    btnOpen: document.getElementById('btnOpen'),
    btnSave: document.getElementById('btnSave'),
    btnTheme: document.getElementById('btnTheme'),
    langSelect: document.getElementById('langSelect'),
    status: document.getElementById('status'),
    editorContainer: document.getElementById('editor'),
    updateBanner: document.getElementById('updateBanner'),
    banner: {
      message: null,
      progress: null,
      btnDownload: null,
      btnRestart: null,
      btnClose: null
    },
    footerText: document.getElementById('footerText'),
    logo: document.getElementById('logo')
  };

  let state = {
    filePath: null,
    origBase64: null,
    editor: null,
    lang: localStorage.getItem('lang') || 'pt-BR',
    dark: localStorage.getItem('theme') === 'true',
    pendingDownloadUrl: null
  };

  // ===== UI Helpers =====
  function setStatus(msg = '', isError = false) {
    if (!msg) {
      UI.status.style.display = 'none';
      return;
    }
    UI.status.style.display = 'block';
    UI.status.textContent = msg;
    UI.status.style.color = isError ? 'red' : '';
  }

  function showBanner(text) {
    UI.updateBanner.hidden = false;
    UI.banner.message.textContent = text;
    UI.banner.progress.style.width = '0%';
  }

  function updateProgress(percent) {
    UI.banner.progress.style.width = percent + '%';
  }

  // ===== Theme =====
  function initTheme() {
    const { btnTheme } = UI;
    btnTheme.innerHTML = state.dark ? icons.sun : icons.moon;
    document.body.dataset.theme = state.dark ? 'dark' : 'light';
    btnTheme.onclick = () => {
      state.dark = !state.dark;
      localStorage.setItem('theme', state.dark);
      initTheme();
    };
  }

  // ===== Localization =====
  function applyTranslations() {
    const T = translations[state.lang];
    document.title = T.title;
    UI.btnOpen.textContent = T.open;
    UI.btnSave.textContent = T.save;
    UI.footerText.textContent = T.footer;
    setStatus(); // limpa status
  }

  function initLocalization() {
    const { langSelect } = UI;
    langSelect.value = state.lang;
    langSelect.onchange = () => {
      state.lang = langSelect.value;
      localStorage.setItem('lang', state.lang);
      window.electronAPI.setLang(state.lang);
      applyTranslations();
    };
    window.electronAPI.setLang(state.lang);
    applyTranslations();
  }

  // ===== Update Banner =====
  function initBanner() {
    UI.updateBanner.innerHTML = `
      <span class="message"></span>
      <div class="progress"><div></div></div>
      <div class="actions">
        <button id="updateDownload" class="hidden">Baixar</button>
        <button id="updateRestart" class="hidden">Reiniciar</button>
        <button id="updateClose" aria-label="Fechar">×</button>
      </div>`;

    const m = UI.updateBanner;
    UI.banner.message = m.querySelector('.message');
    UI.banner.progress = m.querySelector('.progress > div');
    UI.banner.btnDownload = document.getElementById('updateDownload');
    UI.banner.btnRestart = document.getElementById('updateRestart');
    UI.banner.btnClose = document.getElementById('updateClose');

    UI.banner.btnClose.onclick = () => {
      UI.updateBanner.hidden = true;
      UI.banner.btnDownload.classList.add('hidden');
      UI.banner.btnRestart.classList.add('hidden');
    };

    UI.banner.btnDownload.onclick = async () => {
      if (!state.pendingDownloadUrl) return;
      UI.banner.btnDownload.disabled = true;
      UI.banner.btnDownload.textContent = 'Baixando…';
      await window.electronAPI.portableDownload(state.pendingDownloadUrl);
    };

    UI.banner.btnRestart.onclick = async () => {
      UI.banner.btnRestart.disabled = true;
      UI.banner.btnRestart.textContent = 'Reiniciando…';
      await window.electronAPI.portableReplaceAndRestart();
    };
  }

  // ===== IPC & Update Events =====
  function initIPCListeners() {
    const api = window.electronAPI;

    api.onUpdateChecking(data => showBanner(data.message));
    api.onDownloadProgress(data => {
      showBanner(data.message);
      updateProgress(data.percent);
    });
    api.onUpdateDownloaded(data => {
      showBanner(data.message);
      updateProgress(100);
      UI.banner.btnRestart.classList.remove('hidden');
    });
    api.onUpdateError(data => showBanner(data.message));

    api.onPortableUpdateAvailable(({ message, downloadUrl }) => {
      showBanner(message);
      state.pendingDownloadUrl = downloadUrl;
      UI.banner.btnDownload.classList.remove('hidden');
    });
    api.onPortableDownloadProgress(({ percent, kb }) => {
      showBanner(`Baixando (portátil): ${percent}% (${kb} KB/s)`);
      updateProgress(percent);
    });
    api.onPortableDownloadComplete(({ message }) => {
      showBanner(message);
      updateProgress(100);
      UI.banner.btnRestart.classList.remove('hidden');
    });
  }

  // ===== File Open & Save =====
  function initFileOperations() {
    UI.btnSave.disabled = true;

    UI.btnOpen.onclick = async () => {
      try {
        const selected = await window.electronAPI.openFile();
        if (!selected) return setStatus();
        state.filePath = selected;
        const { content, json } = await window.electronAPI.loadJson(selected);
        state.origBase64 = content;

        state.editor?.destroy();
        state.editor = new JSONEditor(UI.editorContainer, { mode: 'form', modes: ['form','text'] });
        state.editor.set(json);

        UI.btnSave.disabled = false;
        setStatus(translations[state.lang].editing + selected);
      } catch (err) {
        console.error(err);
        setStatus(translations[state.lang].failedOpen, true);
      }
    };

    UI.btnSave.onclick = async () => {
      if (!state.editor || !state.filePath) return;
      try {
        UI.btnSave.disabled = true;
        setStatus(translations[state.lang].preparing);

        const jsonData = state.editor.get();
        // liberar conteúdo...
        const trucks = jsonData.SslValue.trucks || {};
        Object.values(trucks).forEach(group => {
          group.trucks.forEach(tr => tr.isDiscovered = true);
          jsonData.SslValue.unlockedTrucks[group.mapKey] = group.trucks.map(tr => tr.name);
        });
        jsonData.SslValue.lockedTrucks = [];
        jsonData.SslValue.unlockedLevels = Object.keys(jsonData.SslValue.levelsProgress || {});

        setStatus(translations[state.lang].prepared);
        const { savedPath, backupPath } = await window.electronAPI.saveJson(
          state.filePath,
          state.origBase64,
          jsonData
        );
        setStatus(
          translations[state.lang].saved + savedPath +
          translations[state.lang].backup + backupPath + ')'
        );
      } catch (err) {
        console.error(err);
        setStatus(translations[state.lang].errorSave, true);
      } finally {
        UI.btnSave.disabled = false;
      }
    };
  }

  // ===== Logo =====
  function initLogo() {
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        UI.logo.src = await window.electronAPI.getAssetPath('logo-roadcraft.png');
      } catch {}
    });
  }

  // ===== Init =====
  function init() {
    initTheme();
    initLocalization();
    initBanner();
    initIPCListeners();
    initFileOperations();
    initLogo();
  }

  init();
})();
