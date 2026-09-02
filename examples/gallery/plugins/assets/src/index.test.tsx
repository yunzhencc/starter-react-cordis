// @vitest-environment jsdom

import type { Context as CordisContext, Plugin } from '@deepseek-ai/cordis';
import type { AssetRecord, GalleryMediaApi, Thumbnail } from '@yunzhen/gallery-formats';
import { Context } from '@deepseek-ai/cordis';
import * as i18n from '@yunzhen/cordis-ui-i18n';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import * as formats from '@yunzhen/gallery-formats';
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as assets from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const thumbnail = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/webp',
} satisfies Thumbnail;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => 'blob:fixture') },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('shows a root chooser when no media root is configured', async () => {
  vi.stubGlobal('galleryMedia', fixtureMediaApi([]));
  const { container, dispose } = await mountGallery([formats, assets]);

  expect(container.querySelector('[data-choose-root]')).not.toBeNull();

  await dispose();
});

it('opens the chosen asset in the route-owned workbench', async () => {
  vi.stubGlobal('galleryMedia', fixtureMediaApi([
    { id: 'bird', name: 'bird.png', extension: '.png', size: 1, modifiedAt: 1 },
  ]));
  const { container, dispose } = await mountGallery([formats, assets]);
  await act(async () => container.querySelector<HTMLButtonElement>('[data-choose-root]')?.click());
  await act(async () => container.querySelector<HTMLElement>('[data-asset-id="bird"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

  expect(container.querySelector('[data-workbench-column] img')?.getAttribute('alt')).toBe('bird.png');

  await dispose();
});

it('keeps unsupported files out of the grid', async () => {
  vi.stubGlobal('galleryMedia', fixtureMediaApi([
    { id: 'notes', name: 'notes.txt', extension: '.txt', size: 1, modifiedAt: 2 },
    { id: 'bird', name: 'bird.png', extension: '.png', size: 1, modifiedAt: 1 },
  ]));
  const { container, dispose } = await mountGallery([formats, assets]);
  await act(async () => container.querySelector<HTMLButtonElement>('[data-choose-root]')?.click());

  expect(container.querySelector('[data-asset-id="notes"]')).toBeNull();
  expect(container.querySelector('[data-asset-id="bird"]')).not.toBeNull();

  await dispose();
});

it('keeps other cards visible when one asset preview fails', async () => {
  const records: AssetRecord[] = [
    { id: 'broken', name: 'broken.png', extension: '.png', size: 1, modifiedAt: 2 },
    { id: 'bird', name: 'bird.png', extension: '.png', size: 1, modifiedAt: 1 },
  ];
  vi.stubGlobal('galleryMedia', fixtureMediaApi(records, { failedReads: new Set(['broken']) }));
  const { container, dispose } = await mountGallery([formats, assets]);
  await act(async () => container.querySelector<HTMLButtonElement>('[data-choose-root]')?.click());

  const failedCard = container.querySelector('[data-asset-id="broken"]');
  expect(failedCard?.textContent).toContain('broken.png');
  expect(failedCard?.textContent).toContain('预览失败');
  expect(container.querySelector('[data-asset-id="bird"]')).not.toBeNull();

  await dispose();
});

it('restores the collapsed sidebar state', async () => {
  localStorage.setItem('gallery.sidebar-open', 'false');
  vi.stubGlobal('galleryMedia', fixtureMediaApi([]));
  const { container, dispose } = await mountGallery([formats, assets]);

  expect(container.querySelector('[data-sidebar-column]')).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('[data-sidebar-toggle][aria-label="展开左侧栏"]')).not.toBeNull();

  await dispose();
});

function fixtureMediaApi(records: readonly AssetRecord[], options: { failedReads?: ReadonlySet<string> } = {}): GalleryMediaApi {
  return {
    chooseRoot: async () => records,
    listAssets: async () => [],
    readAsset: async (id) => {
      if (options.failedReads?.has(id))
        throw new Error(`cannot read ${id}`);
      return new Uint8Array([4, 5, 6]);
    },
    readThumbnail: async (id, processor) => options.failedReads?.has(id) || processor !== 'native@1' ? undefined : thumbnail,
    writeThumbnail: async () => {},
  };
}

async function mountGallery(modules: readonly Plugin.Object<unknown>[]) {
  window.history.replaceState({}, '', '/');
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];
  for (const module of [i18n, renderer, router, layout, ...modules]) {
    const fiber = ctx.plugin(module);
    fibers.push(fiber);
    await fiber.await();
  }
  const container = document.createElement('div');
  let unmount!: () => void;
  await act(async () => {
    unmount = ctx.uiRenderer.mount(container);
  });
  return {
    container,
    async dispose() {
      await act(async () => unmount());
      for (const fiber of fibers.reverse()) await fiber.dispose();
    },
  };
}
