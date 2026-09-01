// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import { apply as applyRenderer, Slot } from '@yunzhen/cordis-ui-renderer';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { apply as applyRouter } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function boot() {
  const ctx = new Context();
  const renderer = ctx.plugin({ apply: applyRenderer });
  await renderer.await();
  const router = ctx.plugin({ inject: ['slots'], apply: applyRouter });
  await router.await();
  const fibers = [router, renderer];
  return {
    ctx,
    container: document.createElement('div'),
    async dispose() {
      for (const fiber of fibers) await fiber.dispose();
    },
    addFiber(fiber: ReturnType<CordisContext['plugin']>) {
      fibers.unshift(fiber);
    },
  };
}

async function bootRouterWithLayout() {
  const app = await boot();
  const Layout = () => (
    <>
      <aside><Slot name="sidebar" /></aside>
      <main><Slot name="main" /></main>
    </>
  );
  const Settings = () => <h1>Settings</h1>;
  const layout = app.ctx.plugin({
    inject: ['routes', 'slots'],
    apply(ctx) {
      ctx.routes.register({
        id: 'app-layout',
        Component: Layout,
        children: {
          main: { kind: 'single', scope: 'root' },
          sidebar: { kind: 'single', scope: 'root' },
        },
      });
      ctx.routes.inject('app-layout', () => ctx.routes.register({
        id: 'settings',
        parentId: 'app-layout',
        path: 'settings',
        Component: Settings,
        navigation: { label: 'Settings', order: 2 },
      }));
      ctx.routes.inject('app-layout', () => ctx.routes.register({
        id: 'dashboard',
        parentId: 'app-layout',
        path: 'dashboard',
        Component: () => null,
        navigation: { label: 'Dashboard', order: 1 },
      }));
      ctx.slots.inject('sidebar.navigation', () => ctx.slots.register(
        { name: 'sidebar.navigation', id: 'custom' },
        () => <>Custom</>,
      ));
      ctx.slots.inject('sidebar.footer', () => ctx.slots.register(
        { name: 'sidebar.footer', id: 'account' },
        () => <>Account</>,
      ));
    },
  });
  await layout.await();
  app.addFiber(layout);
  return app;
}

async function bootRouterWithSettingsSlot() {
  const app = await boot();
  const Settings = () => <section><Slot name="settings.section" /></section>;
  const feature = app.ctx.plugin({
    inject: ['routes', 'slots'],
    apply(ctx) {
      ctx.routes.register({
        id: 'settings',
        path: 'settings',
        Component: Settings,
        children: { 'settings.section': { kind: 'list', scope: 'root' } },
      });
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: 'appearance' },
        () => <>Appearance</>,
      ));
    },
  });
  await feature.await();
  app.addFiber(feature);
  return app;
}

describe('router host', () => {
  it('renders a pathless layout and its settings child through the main slot', async () => {
    window.history.replaceState({}, '', '/settings');
    const { ctx, container, dispose } = await bootRouterWithLayout();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('h1')?.textContent).toBe('Settings');
    await act(async () => unmount());
    await dispose();
  });

  it('renders a route-declared settings slot inside its matched page', async () => {
    window.history.replaceState({}, '', '/settings');
    const { ctx, container, dispose } = await bootRouterWithSettingsSlot();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.textContent).toContain('Appearance');
    await act(async () => unmount());
    await dispose();
  });

  it('renders ordered navigation links and sidebar slots from the route snapshot', async () => {
    window.history.replaceState({}, '', '/settings');
    const { ctx, container, dispose } = await bootRouterWithLayout();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect([...container.querySelectorAll('nav a')].map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Dashboard', '/dashboard'],
      ['Settings', '/settings'],
    ]);
    expect(container.textContent).toContain('Custom');
    expect(container.textContent).toContain('Account');
    await act(async () => unmount());
    await dispose();
  });
});
