import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { MediaLibrary } from './media-library';

const mainDirectory = dirname(fileURLToPath(import.meta.url));
const MEDIA_CHANNELS = {
  chooseRoot: 'gallery-media:choose-root',
  listAssets: 'gallery-media:list-assets',
  readAsset: 'gallery-media:read-asset',
  readThumbnail: 'gallery-media:read-thumbnail',
  writeThumbnail: 'gallery-media:write-thumbnail',
} as const;

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
  ipcMain.handle(MEDIA_CHANNELS.chooseRoot, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    const [root] = result.filePaths;
    return root ? library.setRoot(root) : library.listAssets();
  });
  ipcMain.handle(MEDIA_CHANNELS.listAssets, () => library.listAssets());
  ipcMain.handle(MEDIA_CHANNELS.readAsset, (_event, id: string) => library.readAsset(id));
  ipcMain.handle(MEDIA_CHANNELS.readThumbnail, (_event, id: string, processor: string) => library.readThumbnail(id, processor));
  ipcMain.handle(MEDIA_CHANNELS.writeThumbnail, (_event, id: string, processor: string, thumbnail) => library.writeThumbnail(id, processor, thumbnail));

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
