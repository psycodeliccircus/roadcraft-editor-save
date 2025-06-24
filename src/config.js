// centraliza constantes e paths
const path = require('path');
const os   = require('os');
const { app } = require('electron');

module.exports = {
  GITHUB_OWNER: 'psycodeliccircus',
  GITHUB_REPO:  'roadcraft-editor-save',
  PORTABLE_EXE_NAME: 'roadcraft-editor-save-win-portable.exe',
  LOG_PATH:     path.join(app.getPath('userData'), 'logs', 'main.log'),
  TMP_DIR_PREFIX: path.join(os.tmpdir(), 'update-'),
  BAT_DIR_PREFIX: path.join(os.tmpdir(), 'update-bat-')
};
