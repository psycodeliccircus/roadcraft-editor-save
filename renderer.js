// renderer.js
(async () => {
  // ===== UI Elements =====
  const btnOpen         = document.getElementById('btnOpen');
  const btnSave         = document.getElementById('btnSave');
  const btnTheme        = document.getElementById('btnTheme');
  const langSelect      = document.getElementById('langSelect');
  const statusEl        = document.getElementById('status');
  const editorContainer = document.getElementById('editor');
  const updateBanner    = document.getElementById('updateBanner');

  // Monta HTML do banner de atualização (com botões “Baixar”, “Reiniciar” e “Fechar”)
  updateBanner.innerHTML = `
    <span class="message"></span>
    <div class="progress"><div></div></div>
    <div class="actions">
      <button id="updateDownload" class="hidden">Baixar</button>
      <button id="updateRestart" class="hidden">Reiniciar</button>
      <button id="updateClose" aria-label="Fechar">×</button>
    </div>
  `;

  // Elementos dentro do banner
  const bannerMsg      = updateBanner.querySelector('.message');
  const bannerProg     = updateBanner.querySelector('.progress > div');
  const updateDownload = document.getElementById('updateDownload');
  const updateRestart  = document.getElementById('updateRestart');
  const updateClose    = document.getElementById('updateClose');

  let pendingDownloadUrl = null;

  // Fecha o banner
  updateClose.onclick = () => {
    updateBanner.hidden = true;
    updateDownload.classList.add('hidden');
    updateRestart.classList.add('hidden');
  };

  // Inicia download portátil ao clicar “Baixar”
  updateDownload.onclick = async () => {
    if (!pendingDownloadUrl) return;
    updateDownload.disabled = true;
    updateDownload.textContent = 'Baixando…';
    await window.electronAPI.portableDownload(pendingDownloadUrl);
  };

  // Substitui o executável e reinicia ao clicar “Reiniciar”
  updateRestart.onclick = async () => {
    updateRestart.disabled = true;
    updateRestart.textContent = 'Reiniciando…';
    await window.electronAPI.portableReplaceAndRestart();
  };

  // Funções auxiliares para banner e status
  function showBanner(text) {
    bannerMsg.textContent = text;
    bannerProg.style.width = '0%';
    updateBanner.hidden = false;
  }

  function updateProgress(pct) {
    bannerProg.style.width = pct + '%';
  }

  function setStatus(msg, isError = false) {
    if (!msg) {
      statusEl.style.display = 'none';
      return;
    }
    statusEl.style.display = 'block';
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'red' : '';
  }

  // ===== Theme Toggle =====
  const icons = {
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3 m15.364-6.364l-1.414 1.414 M6.05 17.95l-1.414 1.414 m12.728 0l-1.414-1.414 M6.05 6.05L4.636 7.464 M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>`,
    moon:`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>`
  };

  let dark = localStorage.getItem('theme') === 'true';
  function updateTheme() {
    document.body.dataset.theme = dark ? 'dark' : 'light';
    btnTheme.innerHTML = dark ? icons.sun : icons.moon;
    localStorage.setItem('theme', dark);
  }
  btnTheme.onclick = () => {
    dark = !dark;
    updateTheme();
  };
  updateTheme();

  // ===== Translations =====
  const T = {
    'pt-BR': {
      title:      'Editor de Save Completo do Roadcraft',
      open:       'Abrir arquivo CompleteSave',
      save:       'Salvar arquivo',
      footer:     '© 2025 Roadcraft Editor. Todos os direitos reservados.',
      editing:    'Editando arquivo: ',
      preparing:  'Preparando dados para salvar…',
      prepared:   'Dados preparados. Efetuando salvamento…',
      saved:      'Salvo em: ',
      backup:     ' (backup em: ',
      failedOpen: 'Não foi possível abrir o arquivo',
      errorSave:  'Erro ao salvar o arquivo'
    },
    'en-EN': {
      title:      'Roadcraft Completesave Editor',
      open:       'Open CompleteSave',
      save:       'Save',
      footer:     '© 2025 Roadcraft Editor. All rights reserved.',
      editing:    'Editing: ',
      preparing:  'Preparing data to save...',
      prepared:   'Data prepared. Saving...',
      saved:      'Saved to ',
      backup:     ' (backup at ',
      failedOpen: 'Failed to open file',
      errorSave:  'Error saving file'
    }
  };

  // ===== Language =====
  let lang = localStorage.getItem('lang') || 'pt-BR';
  langSelect.value = lang;
  window.electronAPI.setLang(lang);

  function applyTranslations() {
    const tr = T[lang];
    document.title = tr.title;
    btnOpen.textContent = tr.open;
    btnSave.textContent = tr.save;
    document.getElementById('footerText').textContent = tr.footer;
  }

  langSelect.onchange = () => {
    lang = langSelect.value;
    localStorage.setItem('lang', lang);
    applyTranslations();
    window.electronAPI.setLang(lang);
  };

  applyTranslations();

  // ===== Auto-Updater Events (build instalada) =====
  window.electronAPI.onUpdateChecking(data => {
    showBanner(data.message);
  });
  window.electronAPI.onDownloadProgress(data => {
    showBanner(data.message);
    updateProgress(data.percent);
  });
  window.electronAPI.onUpdateDownloaded(data => {
    showBanner(data.message);
    updateProgress(100);
    updateRestart.classList.remove('hidden');
  });
  window.electronAPI.onUpdateError(data => {
    showBanner(data.message);
  });

  // ===== Portable Update Events =====
  window.electronAPI.onPortableUpdateAvailable(({ message, downloadUrl }) => {
    showBanner(message);
    pendingDownloadUrl = downloadUrl;
    updateDownload.classList.remove('hidden');
  });
  window.electronAPI.onPortableDownloadProgress(({ percent, kb }) => {
    showBanner(`Baixando (portátil): ${percent}% (${kb} KB/s)`);
    updateProgress(percent);
  });
  window.electronAPI.onPortableDownloadComplete(({ message }) => {
    showBanner(message);
    updateProgress(100);
    updateRestart.classList.remove('hidden');
  });

  // ===== File Open =====
  btnOpen.onclick = async () => {
    try {
      const filePath = await window.electronAPI.openFile();
      if (!filePath) return;
      const { content, json } = await window.electronAPI.loadJson(filePath);
      origBase64 = content;
      if (editor) editor.destroy();
      editor = new JSONEditor(editorContainer, { mode: 'form', modes: ['form','text'] });
      editor.set(json);
      btnSave.disabled = false;
      setStatus(T[lang].editing + filePath);
    } catch {
      setStatus(T[lang].failedOpen, true);
    }
  };

  // ===== File Save =====
  btnSave.onclick = async () => {
    if (!editor) return;
    try {
      btnSave.disabled = true;
      setStatus(T[lang].preparing);

      const jsonData = editor.get();

      // libera todos os caminhões
      const trucks = jsonData.SslValue.trucks || {};
      for (const mapKey of Object.keys(trucks)) {
        trucks[mapKey].trucks.forEach(tr => tr.isDiscovered = true);
        jsonData.SslValue.unlockedTrucks[mapKey] =
          trucks[mapKey].trucks.map(tr => tr.name);
      }
      jsonData.SslValue.lockedTrucks = [];

      // libera todos os mapas
      jsonData.SslValue.unlockedLevels =
        Object.keys(jsonData.SslValue.levelsProgress || {});

      setStatus(T[lang].prepared);
      const { savedPath, backupPath } = await window.electronAPI.saveJson(
        filePath, origBase64, jsonData
      );
      setStatus(
        T[lang].saved + savedPath +
        T[lang].backup + backupPath + ')'
      );
    } catch {
      setStatus(T[lang].errorSave, true);
    } finally {
      btnSave.disabled = false;
    }
  };

  // ===== Logo loading =====
  window.addEventListener('DOMContentLoaded', async () => {
    const logo = document.getElementById('logo');
    try {
      const p = await window.electronAPI.getAssetPath('logo-roadcraft.png');
      logo.src = p;
    } catch {
      // fallback silencioso
    }
  });
})();
