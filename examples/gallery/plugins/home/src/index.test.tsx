// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import * as i18n from '@yunzhen/cordis-ui-i18n';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import * as home from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('renders Hello, Gallery! at the app index route', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];
  for (const module of [i18n, renderer, router, layout, home]) {
    const fiber = ctx.plugin(module);
    fibers.push(fiber);
    await fiber.await();
  }
  const container = document.createElement('div');
  let unmount!: () => void;

  await act(async () => {
    unmount = ctx.uiRenderer.mount(container);
  });

  expect(container.querySelector('h1')?.textContent).toBe('Hello, Gallery!');

  await act(async () => unmount());
  for (const fiber of fibers.reverse()) await fiber.dispose();
  vi.unstubAllGlobals();
});
