// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import { apply as applyGeneral, inject as generalInject } from '@examples/agent-settings-general';
import { apply as applyI18n } from '@yunzhen/cordis-ui-i18n';
import { apply as applyRenderer, inject as rendererInject, Slot } from '@yunzhen/cordis-ui-renderer';
import { apply as applyRouter } from '@yunzhen/cordis-ui-router';
import { apply as applySettingsLayout } from '@yunzhen/cordis-ui-settings-layout';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { apply, inject } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'languages', { configurable: true, value: ['zh-CN'] });
  window.history.replaceState({}, '', '/settings/general');
});

async function bootLanguageSettings() {
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];
  const Layout = () => (
    <>
      <aside><Slot name="sidebar" /></aside>
      <main><Slot name="main" /></main>
    </>
  );

  for (const module of [
    { apply: applyI18n },
    { apply: applyRenderer, inject: rendererInject },
    { apply: applyRouter, inject: ['slots'] },
    {
      inject: ['routes', 'slots'],
      apply(pluginCtx: Context) {
        pluginCtx.routes.register({
          id: 'app-layout',
          Component: Layout,
          children: { main: { kind: 'single', scope: 'root' }, sidebar: { kind: 'single', scope: 'root' } },
        });
      },
    },
    { apply: applySettingsLayout, inject: ['i18n', 'routes', 'slots'] },
    { apply: applyGeneral, inject: generalInject },
    { apply, inject },
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

describe('language settings extension', () => {
  it('contributes Language to General instead of creating another settings menu item', async () => {
    const { container, ctx, dispose } = await bootLanguageSettings();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('h1')?.textContent).toBe('常规');
    expect([...container.querySelectorAll('[data-settings-menu] a')].map(link => link.textContent)).toEqual(['常规']);
    expect(container.textContent).toContain('应用 UI 语言');
    const select = container.querySelector('select')!;
    expect(select.value).toBe('zh-CN');

    await act(async () => {
      select.value = 'en-US';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('h1')?.textContent).toBe('General');
    expect(container.textContent).toContain('Application UI language');
    expect(container.textContent).toContain('Return to app');
    expect(select.value).toBe('en-US');

    await act(async () => unmount());
    await dispose();
  });
});
