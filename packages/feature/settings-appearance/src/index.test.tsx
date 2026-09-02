// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import { apply as applyRenderer, Slot } from '@yunzhen/cordis-ui-renderer';
import { apply as applyRouter } from '@yunzhen/cordis-ui-router';
import { apply as applySettingsLayout } from '@yunzhen/cordis-ui-settings-layout';
import { apply as applyTheme } from '@yunzhen/cordis-ui-theme';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function bootAppearance() {
  window.history.replaceState({}, '', '/settings/appearance');
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];
  const Layout = () => (
    <>
      <aside><Slot name="sidebar" /></aside>
      <main><Slot name="main" /></main>
    </>
  );

  for (const module of [
    { apply: applyRenderer },
    { inject: ['slots'], apply: applyRouter },
    {
      inject: ['routes', 'slots'],
      apply(pluginCtx: Context) {
        pluginCtx.routes.register({
          id: 'app-layout',
          Component: Layout,
          children: {
            main: { kind: 'single', scope: 'root' },
            sidebar: { kind: 'single', scope: 'root' },
          },
        });
      },
    },
    { inject: ['routes', 'slots'], apply: applySettingsLayout },
    { apply: applyTheme },
    { inject: ['settings', 'theme'], apply },
  ]) {
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

describe('appearance settings extension', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelector('style[data-cordis-ui-theme]')?.remove();
  });

  it('registers Appearance as a settings page while its fiber is active', async () => {
    const { ctx, container, dispose } = await bootAppearance();
    let unmount!: () => void;

    expect(ctx.settings.snapshot()).toMatchObject([{
      id: 'appearance',
      group: { id: 'personal', label: 'Personal', order: 100 },
      label: 'Appearance',
      order: 100,
    }]);

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.textContent).toContain('Appearance');
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(container.querySelector('input[type="range"]')).not.toBeNull();
    await act(async () => unmount());
    await dispose();
  });
});
