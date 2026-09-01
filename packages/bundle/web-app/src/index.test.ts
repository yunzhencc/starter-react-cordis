// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis';
import * as dashboard from '@yunzhen/cordis-feature-dashboard';
import * as settings from '@yunzhen/cordis-feature-settings';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import * as theme from '@yunzhen/cordis-ui-theme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webAppPlugins } from './index';

describe('webAppPlugins', () => {
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

  it('keeps the static modules in base-first order', () => {
    expect(webAppPlugins).toEqual([renderer, router, layout, theme, dashboard, settings]);
  });

  it('keeps Dashboard as the app-layout index child', async () => {
    window.history.replaceState({}, '', '/');
    const ctx = new Context();
    const fibers = webAppPlugins.map(module => ctx.plugin(module));
    for (const fiber of fibers) await fiber.await();

    expect(ctx.routes.snapshot().find(route => route.id === 'dashboard')).toMatchObject({
      parentId: 'app-layout',
      index: true,
    });

    for (const fiber of fibers.reverse()) await fiber.dispose();
  });
});
