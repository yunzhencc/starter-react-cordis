// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCE_STORAGE_KEY, ThemeRuntime } from './theme';
import { ThemeToggle } from './theme-toggle';

describe('themeToggle', () => {
  let theme: ThemeRuntime;
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    theme = new ThemeRuntime();
    container = document.createElement('div');
    root = createRoot(container);
    await act(async () => root.render(<ThemeToggle theme={theme} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    theme.dispose();
    vi.unstubAllGlobals();
  });

  it('switches the resolved light theme to the persisted dark preference', async () => {
    const button = container.querySelector('button');

    expect(button?.textContent).toBe('Switch to dark theme');
    await act(async () => button?.click());

    expect(theme.snapshot).toMatchObject({ preference: 'dark', resolvedTheme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(PREFERENCE_STORAGE_KEY)).toBe('dark');
  });
});
