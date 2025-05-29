// build.js
const builder   = require('electron-builder');
const fetch     = require('node-fetch');
const fs        = require('fs');
const path      = require('path');
const png2icons = require('png2icons');
const Jimp      = require('jimp');
const { productName } = require('./package.json');
const { productName2 } = require('./package.json');

class Builder {
  async build() {
    builder.build({
      config: {
        generateUpdatesFilesForAllChannels: false,
        appId: `com.github.psycodeliccircus.${productName}`,
        productName: productName,
        executableName: productName,
        icon: './build/icon.ico',
        copyright: `Copyright © 2025 ${productName2} - Desenvolvido por: RenildoMarcio`,
        artifactName: '${productName}-${os}-${arch}.${ext}',
        files: [
          '**/*',
          'package.json',
          'LICENSE',
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
          icon: './build/icon.ico',
          target: [
            { target: 'nsis', arch: ['x64', 'ia32'] }
          ]
        },
        nsis: {
          artifactName: '${productName}-${os}-${arch}.exe',
          installerIcon: './build/icon.ico',
          uninstallerIcon: './build/uninstall.ico',
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          runAfterFinish: true,
          createStartMenuShortcut: true,
          createDesktopShortcut: true,
          shortcutName: productName2,
          license: './eula.txt'
        },
        mac: {
          icon: './build/icon.icns',
          category: 'public.app-category.developer-tools',
          target: [
            { target: 'dmg', arch: ['x64', 'arm64'] }
          ]
        },
        dmg: {
          artifactName: '${productName}-${os}-${arch}.dmg',
          title: `${productName2} Installer`
        },
        linux: {
          icon: './build/icon.png',
          target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'tar.gz', arch: ['x64', 'arm64'] }
          ]
        },
        appImage: {
          artifactName: '${productName}-${os}-${arch}.AppImage',
          category: 'Development',
          license: './eula.txt'
        },
        extraResources: [
          { from: 'build/icon.png', to: 'build/icon.png' },
          { from: 'build/icon.icns', to: 'build/icon.icns' },
          { from: 'build/icon.ico', to: 'build/icon.ico' },
          { from: 'build/logo-roadcraft.png', to: 'build/logo-roadcraft.png' },
          { from: 'eula.txt', to: 'build/eula.txt' }
        ],
        protocols: {
          name: productName,
          schemes: ['roadcraft-editor-save']
        }
      }
    })
    .then(() => console.log('Build concluída com sucesso!'))
    .catch(err => console.error('Erro durante a build:', err));
  }

  async iconSet(url) {
    console.log(`Baixando ícone de ${url}…`);
    const res = await fetch(url);
    if (res.status !== 200) {
      return console.error('Erro de conexão:', res.status);
    }

    let buffer = await res.buffer();

    // remove bytes após IEND chunk, se houver lixo
    const IEND = Buffer.from([0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82]);
    const iendOffset = buffer.indexOf(IEND);
    if (iendOffset !== -1) {
      buffer = buffer.slice(0, iendOffset + IEND.length);
    }

    try {
      const image = await Jimp.read(buffer);
      const resized = await image
        .resize(256, 256)
        .getBufferAsync(Jimp.MIME_PNG);

      const buildDir = path.join(__dirname, 'build');
      fs.mkdirSync(buildDir, { recursive: true });

      // PNG
      fs.writeFileSync(path.join(buildDir, 'icon.png'), resized);
      // ICO
      fs.writeFileSync(
        path.join(buildDir, 'icon.ico'),
        png2icons.createICO(resized, png2icons.HERMITE, 0, false)
      );
      // ICNS
      fs.writeFileSync(
        path.join(buildDir, 'icon.icns'),
        png2icons.createICNS(resized, png2icons.BILINEAR, 0)
      );

      console.log('Ícones gerados em build/: icon.png, icon.ico, icon.icns');
    } catch (err) {
      console.error('Erro ao processar imagem com Jimp:', err);
    }
  }
}

const builderInstance = new Builder();
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--icon=')) {
    builderInstance.iconSet(arg.split('=')[1]);
  } else if (arg === '--build') {
    builderInstance.build();
  }
});
