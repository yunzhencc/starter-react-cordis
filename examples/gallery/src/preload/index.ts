import type { GalleryMediaApi, GalleryPluginApi } from '@yunzhen/gallery-formats';
import { contextBridge, ipcRenderer } from 'electron';

const galleryMedia: GalleryMediaApi = {
  chooseRoot: () => ipcRenderer.invoke('gallery-media:choose-root'),
  listAssets: () => ipcRenderer.invoke('gallery-media:list-assets'),
  readAsset: id => ipcRenderer.invoke('gallery-media:read-asset', id),
  readThumbnail: (id, processor) => ipcRenderer.invoke('gallery-media:read-thumbnail', id, processor),
  writeThumbnail: (id, processor, thumbnail) => ipcRenderer.invoke('gallery-media:write-thumbnail', id, processor, thumbnail),
};

const galleryPlugin: GalleryPluginApi = {
  install: () => ipcRenderer.invoke('gallery-plugin:install'),
  list: () => ipcRenderer.invoke('gallery-plugin:list'),
  setEnabled: (id, enabled) => ipcRenderer.invoke('gallery-plugin:set-enabled', id, enabled),
  uninstall: id => ipcRenderer.invoke('gallery-plugin:uninstall', id),
};

contextBridge.exposeInMainWorld('galleryMedia', galleryMedia);
contextBridge.exposeInMainWorld('galleryPlugin', galleryPlugin);
