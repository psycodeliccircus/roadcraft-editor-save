// build.js
const builder   = require('electron-builder');
const nodeFetch = require('node-fetch');
const fs        = require('fs');
const path      = require('path');
const png2icons = require('png2icons');
const Jimp      = require('jimp');
const { productName } = require('./package.json');

class Index {
  async build() {
    builder.build({
      config: {
        generateUpdatesFilesForAllChannels: false,
        appId: 'com.github.psycodeliccircus.roadcraft-editor-save',
        productName: productName,
        executableName: productName,
        icon: './src/build/icon.ico',
        copyright:
          'Copyright © 1984-2025 RoadCraft Editor Save - Dev by RenildoMarcio',
        artifactName: '${productName}-${os}-${arch}.${ext}',
        files: [
          '**/*',
          'package.json',
          'LICENSE.md',
          'eula.txt'
        ],
        directories: { output: 'dist' },
        compression: 'maximum',
        asar: true,
        publish: [{
          provider: 'github',
          releaseType: 'release'
        }],
        win: {
          icon: './src/build/icon.ico',
          target: [
            { target: 'portable', arch: ['x64', 'ia32'] },
            { target: 'nsis',     arch: ['x64', 'ia32'] }
          ]
        },
        // Configurações específicas para o build "portable"
        portable: {
          // Nome do arquivo .exe gerado para o portable
          artifactName: '${productName}-${os}-${arch}-portable.exe',
          // Você pode adicionar outras opções aqui se necessário
        },
        nsis: {
          artifactName: '${productName}-${os}-${arch}.exe',
          installerIcon: './src/build/icon.ico',
          uninstallerIcon: './src/build/uninstall.ico',
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          runAfterFinish: true,
          createStartMenuShortcut: true,
          packElevateHelper: true,
          createDesktopShortcut: true,
          shortcutName: 'RoadCraft Editor Save',
          license: './eula.txt'
        },
        mac: {
          icon: './src/build/icon.icns',
          category: 'public.app-category.games',
          target: [{ target: 'dmg', arch: ['x64', 'arm64'] }]
        },
        dmg: {
          artifactName: '${productName}-${os}-${arch}.dmg',
          title: 'RoadCraft Editor Save Installer'
        },
        linux: {
          icon: './src/build/icon.png',
          target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'tar.gz',   arch: ['x64', 'arm64'] }
          ]
        },
        appImage: {
          artifactName: '${productName}-${os}-${arch}.AppImage',
          category: 'Game',
          license: './eula.txt'
        },
        extraResources: [
          { from: 'src/build/icon.png',                to: 'build/icon.png' },
          { from: 'eula.txt',                      to: 'eula.txt' },
          { from: 'src/build/logo-roadcraft.png',      to: 'build/logo-roadcraft.png' }
        ],
        protocols: {
          name: 'roadcraft-editor-save',
          schemes: ['roadcraft-editor-saves','roadcraft-editor-save']
        }
      }
    })
    .then(() => console.log('A build está concluída'))
    .catch(err => console.error('Erro durante a build!', err));
  }

  async iconSet(url) {
    console.log(`Baixando ícone de ${url}…`);
    const res = await nodeFetch(url);
    if (res.status !== 200) {
      return console.error('connection error', res.status);
    }

    let buffer = await res.buffer();

    const IEND = Buffer.from([0,0,0x00,0x00,0x49,0x45,0x4E,0x44]);
    const iendOffset = buffer.indexOf(IEND);
    if (iendOffset !== -1) {
      buffer = buffer.slice(0, iendOffset + 12);
    }

    try {
      const image = await Jimp.read(buffer);
      const resized = await image
        .resize(256, 256)
        .getBufferAsync(Jimp.MIME_PNG);

      const buildDir = path.join(__dirname, 'src/build');
      fs.mkdirSync(buildDir, { recursive: true });

      fs.writeFileSync(path.join(buildDir, 'icon.png'), resized);
      fs.writeFileSync(
        path.join(buildDir, 'icon.ico'),
        png2icons.createICO(resized, png2icons.HERMITE, 0, false)
      );
      fs.writeFileSync(
        path.join(buildDir, 'icon.icns'),
        png2icons.createICNS(resized, png2icons.BILINEAR, 0)
      );
      console.log('Ícones gerados em build/');
    } catch (err) {
      console.error('Erro ao processar a imagem via Jimp:', err);
    }
  }
}

const inst = new Index();
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--icon=')) {
    inst.iconSet(arg.split('=')[1]);
  } else if (arg === '--build') {
    inst.build();
  }
});
