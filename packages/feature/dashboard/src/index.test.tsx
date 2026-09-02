// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dashboard from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function bootDashboard() {
  window.history.replaceState({}, '', '/');
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];

  for (const module of [renderer, router, layout, dashboard]) {
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

describe('dashboard module', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens its contributed workbench after the Dashboard button is clicked', async () => {
    const { ctx, container, dispose } = await bootDashboard();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    expect(ctx.layout.snapshot().workbenchOpen).toBe(false);

    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });

    expect(ctx.layout.snapshot().workbenchOpen).toBe(true);
    expect(container.querySelector('[data-workbench-column]')?.textContent).toContain('Dashboard workbench');

    await act(async () => unmount());
    await dispose();
  });
});
