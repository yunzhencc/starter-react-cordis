// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as themeModule from './index';
import { ThemeRuntime } from './theme';

const tokens = readFileSync('packages/ui/theme/src/tokens.css', 'utf8');

describe('uiThemePlugin', () => {
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

  it('provides theme and contributes Appearance only while its fiber is active', async () => {
    const ctx = new Context();
    const rendererFiber = ctx.plugin(renderer);
    await rendererFiber.await();
    const themeFiber = ctx.plugin(themeModule);
    await themeFiber.await();
    const owner = ctx.slots.createOwner('settings', {
      'settings.section': { kind: 'list', scope: 'root' },
    });

    expect(ctx.get('theme')).toBeInstanceOf(ThemeRuntime);
    expect(ctx.slots.entries('settings.section').map(({ id, order }) => [id, order])).toEqual([['appearance', 100]]);
    const style = document.head.querySelector<HTMLStyleElement>('style[data-cordis-ui-theme]');
    expect(style).not.toBeNull();

    await themeFiber.dispose();

    expect(ctx.get('theme')).toBeUndefined();
    expect(ctx.slots.entries('settings.section')).toEqual([]);
    expect(document.head.querySelector('style[data-cordis-ui-theme]')).toBeNull();
    owner.dispose();
    await rendererFiber.dispose();
  });

  it('applies the system font stack from the theme tokens', () => {
    const style = document.createElement('style');
    style.textContent = tokens;
    document.head.append(style);

    expect(getComputedStyle(document.documentElement).fontFamily).toBe('system-ui, sans-serif');
    style.remove();
  });
});
