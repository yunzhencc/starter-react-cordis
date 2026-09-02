// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import * as i18n from '@yunzhen/cordis-ui-i18n';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as home from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('keeps the sidebar control in the titlebar safe area while the sidebar is toggled', async () => {
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
  const collapseButton = container.querySelector<HTMLButtonElement>('[data-sidebar-toggle][aria-label="折叠左侧栏"]');
  expect(collapseButton).not.toBeNull();
  const headerAction = container.querySelector<HTMLElement>('[data-sidebar-header-action]');
  expect(headerAction?.contains(collapseButton!)).toBe(true);
  expect(headerAction?.style.left).toBe('92px');
  expect(headerAction?.style.top).toBe('8px');
  expect(collapseButton?.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelectorAll('[data-sidebar-toggle]')).toHaveLength(1);
  expect(collapseButton?.querySelector('svg')?.getAttribute('class')).toContain('lucide-panel-left-close');

  await act(async () => collapseButton?.click());

  expect(container.querySelector('[data-sidebar-column]')).toBeNull();
  const expandButton = container.querySelector<HTMLButtonElement>('[data-sidebar-toggle][aria-label="展开左侧栏"]');
  expect(expandButton).not.toBeNull();
  expect(headerAction?.contains(expandButton!)).toBe(true);
  expect(expandButton?.getAttribute('aria-expanded')).toBe('false');
  expect(expandButton?.querySelector('svg')?.getAttribute('class')).toContain('lucide-panel-left-open');
  expect(container.querySelectorAll('[data-sidebar-toggle]')).toHaveLength(1);
  expect(localStorage.getItem('gallery.sidebar-open')).toBe('false');

  await act(async () => expandButton?.click());

  expect(container.querySelector('[data-sidebar-column]')).not.toBeNull();
  expect(container.querySelector<HTMLButtonElement>('[data-sidebar-toggle][aria-label="折叠左侧栏"]')).not.toBeNull();
  expect(localStorage.getItem('gallery.sidebar-open')).toBe('true');

  await act(async () => unmount());
  for (const fiber of fibers.reverse()) await fiber.dispose();
});

it('restores the collapsed sidebar state', async () => {
  localStorage.setItem('gallery.sidebar-open', 'false');
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

  expect(container.querySelector('[data-sidebar-column]')).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('[data-sidebar-toggle][aria-label="展开左侧栏"]')).not.toBeNull();

  await act(async () => unmount());
  for (const fiber of fibers.reverse()) await fiber.dispose();
});
