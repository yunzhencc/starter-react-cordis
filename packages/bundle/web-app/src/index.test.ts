import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app';
import { createAppRuntime } from '@yunzhen/cordis-runtime';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('webAppPlugins', () => {
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

  it('loads the built-in dashboard and settings routes', async () => {
    const runtime = await createAppRuntime(webAppPlugins);

    expect(runtime.routes.map(({ id, path, index, navigation }) => [id, path, index, navigation?.order])).toEqual([
      ['dashboard', undefined, true, 0],
      ['settings', 'settings', undefined, 100],
    ]);
    expect(runtime.get('theme')).toBeDefined();
    expect(runtime.settingsItems.map(item => item.id)).toEqual(['appearance']);
    expect(runtime.getSlotItems('shell.content.header').map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 'theme-toggle', order: 100 },
    ]);
    await runtime.dispose();
  });
});
