// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis';
import { apply as applyRenderer } from '@yunzhen/cordis-ui-renderer';
import { apply as applyRouter } from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { apply } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const Workbench = () => <section>Workbench</section>;
const EmptyPage = () => null;

async function bootLayout() {
  window.history.replaceState({}, '', '/');
  const ctx = new Context();
  const renderer = ctx.plugin({ apply: applyRenderer });
  await renderer.await();
  const router = ctx.plugin({ inject: ['slots'], apply: applyRouter });
  await router.await();
  const layout = ctx.plugin({ inject: ['routes', 'slots'], apply });
  await layout.await();
  ctx.routes.register({ id: 'layout-index', parentId: 'app-layout', index: true, Component: EmptyPage });

  return {
    ctx,
    container: document.createElement('div'),
    async dispose() {
      await layout.dispose();
      await router.dispose();
      await renderer.dispose();
    },
  };
}

describe('app layout', () => {
  it('fully hides the sidebar and lets main fill the frame', async () => {
    const { ctx, container, dispose } = await bootLayout();
    ctx.layout.toggleSidebar();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('[data-app-layout]')?.getAttribute('data-sidebar-open')).toBe('false');
    expect(container.querySelector('[data-sidebar-column]')).toBeNull();
    expect((container.querySelector('[data-app-layout]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)');

    await act(async () => unmount());
    await dispose();
  });

  it('keeps workbench hidden without an occupant and closes it on request', async () => {
    const { ctx, container, dispose } = await bootLayout();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(container.querySelector('[data-workbench-column]')).toBeNull();
    ctx.slots.register({ name: 'workbench' }, Workbench);
    ctx.layout.openWorkbench();
    await act(async () => {});
    expect(container.querySelector('[data-workbench-column]')).not.toBeNull();
    ctx.layout.closeWorkbench();
    await act(async () => {});
    expect(container.querySelector('[data-workbench-column]')).toBeNull();

    await act(async () => unmount());
    await dispose();
  });

  it('shows an occupant registered after the workbench opens', async () => {
    const { ctx, container, dispose } = await bootLayout();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
      ctx.layout.openWorkbench();
    });

    expect(container.querySelector('[data-workbench-column]')).toBeNull();
    await act(async () => {
      ctx.slots.register({ name: 'workbench' }, Workbench);
    });
    expect(container.querySelector('[data-workbench-column]')).not.toBeNull();

    await act(async () => unmount());
    await dispose();
  });
});
