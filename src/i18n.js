// helper de traduções com API simples
const translations = {
  'pt-BR': {
    checkingUpdates:    'Verificando atualizações...',
    downloading:        (pct, kb) => `Baixando: ${pct}% (${kb} KB/s)`,
    downloaded:         'Download concluído. Clique em Reiniciar para aplicar.',
    dialogTitle:        'Roadcraft Editor',
    saveSuccess:        'Arquivo salvo com sucesso!',
    invalidPath:        'Caminho de arquivo original inválido.',
    updateError:        err => `Erro no auto-updater: ${err}`
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

let lang = 'en-EN';

function setLocale(locale) {
  const l = locale.toLowerCase();
  lang = l.startsWith('pt') ? 'pt-BR' : 'en-EN';
}

function t(key, ...args) {
  const entry = translations[lang][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

module.exports = { setLocale, t };
