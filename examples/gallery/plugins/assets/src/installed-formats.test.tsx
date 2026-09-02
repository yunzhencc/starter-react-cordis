// @vitest-environment jsdom

import type { GalleryPluginApi, InstalledGalleryPlugin } from '@yunzhen/gallery-formats';
import { Context } from '@deepseek-ai/cordis';
import * as formats from '@yunzhen/gallery-formats';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { InstalledFormatController, InstalledPluginViewer } from './installed-formats';

const plugin = {
  enabled: true,
  formats: [{ extension: '.psd', thumbnailWorker: 'thumbnail/psd.worker.js', viewer: 'viewer/psd.html' }],
  id: 'com.example.psd',
  name: 'PSD Format',
  version: '1.0.0',
} satisfies InstalledGalleryPlugin;

it('registers enabled extensions and releases them when the controller disposes', async () => {
  const ctx = new Context();
  const fiber = ctx.plugin(formats);
  await fiber.await();
  const controller = new InstalledFormatController(ctx.formats, fixturePlugins([plugin]));

  await controller.refresh();
  expect(ctx.formats.find('.psd')?.id).toBe('com.example.psd:.psd');

  controller.dispose();
  expect(ctx.formats.find('.psd')).toBeUndefined();
  await fiber.dispose();
});

it('loads the viewer in a script-only sandbox', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<InstalledPluginViewer descriptor={plugin.formats[0]!} name="design.psd" plugin={plugin} source={new Uint8Array([1])} />));

  const frame = container.querySelector('iframe');
  expect(frame?.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame?.getAttribute('src')).toBe('gallery-plugin://com.example.psd/viewer/psd.html');
  await act(async () => root.unmount());
});

function fixturePlugins(plugins: readonly InstalledGalleryPlugin[]): GalleryPluginApi {
  return {
    install: async () => { throw new Error('not implemented'); },
    list: async () => plugins,
    setEnabled: async () => plugins,
    uninstall: async () => plugins,
  };
}
