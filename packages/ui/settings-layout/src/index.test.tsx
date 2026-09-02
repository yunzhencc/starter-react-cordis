// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import { apply as applyRenderer, Slot } from '@yunzhen/cordis-ui-renderer';
import { apply as applyRouter } from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { apply } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const Null = () => null;

async function bootSettings(path: string) {
  window.history.replaceState({}, '', path);
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
        pluginCtx.routes.inject('app-layout', () => pluginCtx.routes.register({
          id: 'dashboard',
          parentId: 'app-layout',
          index: true,
          Component: () => <h1>Dashboard</h1>,
          navigation: { label: 'Dashboard', order: 0 },
        }));
      },
    },
    { inject: ['routes', 'slots'], apply },
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

describe('settings layout', () => {
  it('replaces the app sidebar and redirects to the first sorted settings page', async () => {
    const { ctx, container, dispose } = await bootSettings('/settings');
    ctx.settings.register({
      id: 'appearance',
      group: { id: 'personal', label: 'Personal', order: 100 },
      label: 'Appearance',
      order: 100,
      Component: () => <p>Appearance content</p>,
    });
    ctx.settings.register({
      id: 'shortcuts',
      group: { id: 'coding', label: 'Coding', order: 200 },
      label: 'Keyboard shortcuts',
      order: 10,
      Component: Null,
    });
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('[data-settings-sidebar]')).not.toBeNull();
    expect(container.textContent).toContain('Return to app');
    expect([...container.querySelectorAll('[data-settings-menu] a')].map(link => link.textContent)).toEqual([
      'Appearance',
      'Keyboard shortcuts',
    ]);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Appearance');
    expect(container.textContent).toContain('Appearance content');

    await act(async () => unmount());
    await dispose();
  });
});
