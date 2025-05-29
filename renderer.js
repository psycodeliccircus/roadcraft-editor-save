(async () => {
  // Elementos da UI
  const btnOpen    = document.getElementById('btnOpen');
  const btnSave    = document.getElementById('btnSave');
  const btnTheme   = document.getElementById('btnTheme');
  const statusEl   = document.getElementById('status');
  const langSelect = document.getElementById('langSelect');
  const editorContainer = document.getElementById('editor');

  let origBase64 = null, filePath = null, editor = null;

  // Ícones SVG
  const icons = {
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3
                     m15.364-6.364l-1.414 1.414
                     M6.05 17.95l-1.414 1.414
                     m12.728 0l-1.414-1.414
                     M6.05 6.05L4.636 7.464
                     M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
      </svg>`
  };

  // Dicionário de traduções
  const T = {
    'pt-BR': {
      title:    'RoadCraft Editor Save',
      open:     'Abrir CompleteSave',
      save:     'Salvar',
      footer:   '© 2025 RoadCraft Editor Save. Todos os direitos reservados.',
      editing:  'Editando: ',
      preparing:'Preparando dados para salvar...',
      prepared: 'Dados preparados. Salvando...',
      saved:    'Salvo em ',
      backup:   ' (backup em ',
      failedOpen: 'Falha ao abrir arquivo',
      errorSave:  'Erro ao salvar arquivo'
    },
    'en-EN': {
      title:    'RoadCraft Editor Save',
      open:     'Open CompleteSave',
      save:     'Save',
      footer:   '© 2025 RoadCraft Editor Save. All rights reserved.',
      editing:  'Editing: ',
      preparing:'Preparing data to save...',
      prepared: 'Data prepared. Saving...',
      saved:    'Saved to ',
      backup:   ' (backup at ',
      failedOpen: 'Failed to open file',
      errorSave:  'Error saving file'
    }
  };

  // Helper para atualizar o status
    function setStatus(msg, isError = false) {
    if (!msg) {
        statusEl.style.display = 'none';
        return;
    }
    statusEl.style.display = 'block';          // mostra quando recebe texto
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'red' : '';
    }

  // Seleção de tema (dark por padrão)
  let storedTheme = localStorage.getItem('theme');
  let dark = (storedTheme === null) ? true : (storedTheme === 'true');
  function updateTheme() {
    document.body.dataset.theme = dark ? 'dark' : 'light';
    btnTheme.innerHTML = dark ? icons.sun : icons.moon;
    localStorage.setItem('theme', dark);
  }

  // Seleção de idioma (pt-BR por padrão)
  let lang = localStorage.getItem('lang') || 'pt-BR';
  langSelect.value = lang;

  function applyTranslations() {
    const tr = T[lang];
    document.title             = tr.title;
    document.querySelector('header h1')?.remove(); // se existir
    // Inserimos o título no header
    const hdr = document.createElement('h1');
    hdr.id = 'title';
    hdr.textContent = tr.title;
    //document.querySelector('header').prepend(hdr);
    btnOpen.textContent         = tr.open;
    btnSave.textContent         = tr.save;
    footerText.textContent        = tr.footer;
  }

  // Atualiza status de auto-update
  window.electronAPI.onUpdateStatus(msg => setStatus(msg));

  // Evento: mudar idioma
  langSelect.addEventListener('change', () => {
    lang = langSelect.value;
    localStorage.setItem('lang', lang);
    applyTranslations();
  });

  // Botão Abrir
  btnOpen.addEventListener('click', async () => {
    try {
      filePath = await window.electronAPI.openFile();
      if (!filePath) return;
      const { content, json } = await window.electronAPI.loadJson(filePath);
      origBase64 = content;
      if (editor) editor.destroy();
      editor = new JSONEditor(editorContainer, {
        mode: 'form',
        modes: ['form','text']
      });
      editor.set(json);
      btnSave.disabled = false;
      setStatus(T[lang].editing + filePath);
    } catch {
      setStatus(T[lang].failedOpen, true);
    }
  });

  // Botão Salvar
  btnSave.addEventListener('click', async () => {
    if (!editor) return;
    try {
      btnSave.disabled = true;
      setStatus(T[lang].preparing);

      const jsonData = editor.get();

      // Libera todos os caminhões
      const trucksContainer = jsonData.SslValue.trucks || {};
      for (const mapKey of Object.keys(trucksContainer)) {
        const mapData = trucksContainer[mapKey];
        mapData.trucks.forEach(tr => tr.isDiscovered = true);
        const allNames = mapData.trucks.map(tr => tr.name);
        jsonData.SslValue.unlockedTrucks[mapKey] = allNames;
      }
      jsonData.SslValue.lockedTrucks = [];

      // Libera todos os mapas
      const allMaps = Object.keys(jsonData.SslValue.levelsProgress || {});
      jsonData.SslValue.unlockedLevels = allMaps;

      setStatus(T[lang].prepared);
      const { savedPath, backupPath } = await window.electronAPI.saveJson(
        filePath, origBase64, jsonData
      );
      setStatus(
        T[lang].saved + savedPath + T[lang].backup + backupPath + ')'
      );
    } catch {
      setStatus(T[lang].errorSave, true);
    } finally {
      btnSave.disabled = false;
    }
  });

  // Botão tema
  btnTheme.addEventListener('click', () => {
    dark = !dark;
    updateTheme();
  });

  // Inicializações
  applyTranslations();
  updateTheme();
})();
