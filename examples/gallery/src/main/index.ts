import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import { FormatPluginManager } from './format-plugin-manager';
import { MediaLibrary } from './media-library';
import { createPluginProtocolHandler } from './plugin-protocol';

const mainDirectory = dirname(fileURLToPath(import.meta.url));
const MEDIA_CHANNELS = {
  chooseRoot: 'gallery-media:choose-root',
  listAssets: 'gallery-media:list-assets',
  readAsset: 'gallery-media:read-asset',
  readThumbnail: 'gallery-media:read-thumbnail',
  writeThumbnail: 'gallery-media:write-thumbnail',
} as const;
const PLUGIN_CHANNELS = {
  install: 'gallery-plugin:install',
  list: 'gallery-plugin:list',
  setEnabled: 'gallery-plugin:set-enabled',
  uninstall: 'gallery-plugin:uninstall',
} as const;

protocol.registerSchemesAsPrivileged([{ scheme: 'gallery-plugin', privileges: { secure: true, standard: true, supportFetchAPI: true } }]);

function createWindow() {
  const window = new BrowserWindow({
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(mainDirectory, '../preload/index.mjs'),
      sandbox: false,
    },
  });
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl)
    void window.loadURL(rendererUrl);
  else
    void window.loadFile(join(mainDirectory, '../renderer/index.html'));
}

void app.whenReady().then(async () => {
  const galleryRoot = join(app.getPath('userData'), 'gallery');
  const library = await MediaLibrary.create({
    cacheRoot: join(galleryRoot, 'thumbnails'),
    configPath: join(galleryRoot, 'config.json'),
  });
  const plugins = await FormatPluginManager.create({
    configPath: join(galleryRoot, 'plugins.json'),
    pluginsRoot: join(galleryRoot, 'plugins'),
  });
  protocol.handle('gallery-plugin', createPluginProtocolHandler(plugins));
  ipcMain.handle(MEDIA_CHANNELS.chooseRoot, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    const [root] = result.filePaths;
    return root ? library.setRoot(root) : library.listAssets();
  });
  ipcMain.handle(MEDIA_CHANNELS.listAssets, () => library.listAssets());
  ipcMain.handle(MEDIA_CHANNELS.readAsset, (_event, id: string) => library.readAsset(id));
  ipcMain.handle(MEDIA_CHANNELS.readThumbnail, (_event, id: string, processor: string) => library.readThumbnail(id, processor));
  ipcMain.handle(MEDIA_CHANNELS.writeThumbnail, (_event, id: string, processor: string, thumbnail) => library.writeThumbnail(id, processor, thumbnail));
  ipcMain.handle(PLUGIN_CHANNELS.install, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ extensions: ['zip'], name: 'Gallery Format Plugin' }],
      properties: ['openFile'],
    });
    const [zipPath] = result.filePaths;
    if (!zipPath)
      throw new Error('format plugin installation cancelled');
    return plugins.install(zipPath);
  });
  ipcMain.handle(PLUGIN_CHANNELS.list, () => plugins.list());
  ipcMain.handle(PLUGIN_CHANNELS.setEnabled, (_event, id: string, enabled: boolean) => plugins.setEnabled(id, enabled));
  ipcMain.handle(PLUGIN_CHANNELS.uninstall, (_event, id: string) => plugins.uninstall(id));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit();
});
