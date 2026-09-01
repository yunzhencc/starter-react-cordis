// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import * as theme from '@yunzhen/cordis-ui-theme';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as settings from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function bootBuiltInModules(path: string) {
  window.history.replaceState({}, '', path);
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];

  for (const module of [renderer, router, layout, theme, settings]) {
    const fiber = ctx.plugin(module);
    fibers.push(fiber);
    await fiber.await();
  }

  return {
    ctx,
    container: document.createElement('div'),
    async dispose() {
      for (const fiber of fibers.reverse()) await fiber.dispose();
    },
  };
}

describe('settings module', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelector('style[data-cordis-ui-theme]')?.remove();
  });

  it('registers settings below app-layout and renders its Appearance section', async () => {
    const { ctx, container, dispose } = await bootBuiltInModules('/settings');
    expect(ctx.routes.snapshot().find(route => route.id === 'settings')).toMatchObject({
      parentId: 'app-layout',
      path: 'settings',
    });
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('h1')?.textContent).toBe('Settings');
    expect(container.textContent).toContain('Appearance');

    await act(async () => unmount());
    await dispose();
  });
});
