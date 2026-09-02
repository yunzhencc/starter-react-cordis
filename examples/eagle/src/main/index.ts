import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';

const mainDirectory = dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
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

void app.whenReady().then(() => {
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
