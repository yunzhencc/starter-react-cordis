import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it, vi } from 'vitest';
import { cordisWebBoot, emitWebBootGraph, renderWebBootVirtualModule } from './vite-plugin';

const graph = {
  revision: 'r1',
  entries: [{ id: 'renderer', name: '@app/renderer', inject: [], immediately: true }],
};

it('maps each catalog package to its client import', () => {
  const source = renderWebBootVirtualModule(graph);

  expect(source).toContain('import(\'@app/renderer/client\')');
  expect(source).toContain('[\'@app/renderer\', load0]');
});

it('emits the same graph as cordis.boot.json', () => {
  const output: Array<{ fileName: string; source: string }> = [];
  emitWebBootGraph({ emitFile: file => output.push(file as never) }, graph);

  expect(JSON.parse(output[0]!.source)).toEqual(graph);
});

it('resolves a supplied virtual module id', () => {
  const plugin = cordisWebBoot({ virtualModuleId: 'virtual:cordis-gallery-boot' });

  expect(plugin.resolveId?.('virtual:cordis-gallery-boot')).toBe('\0virtual:cordis-gallery-boot');
});

it('reloads the virtual boot graph when its catalog changes', () => {
  const root = mkdtempSync(join(import.meta.dirname, '.cordis-vite-plugin-'));
  const configPath = join(root, 'cordis.yml');
  const virtualModuleId = 'virtual:cordis-agent-test-boot';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;
  writeFileSync(configPath, '- id: i18n\n  name: \'@yunzhen/cordis-ui-i18n\'\n');
  const plugin = cordisWebBoot({ configPath, virtualModuleId });
  const module = { id: resolvedVirtualModuleId };
  const add = vi.fn();
  const invalidateModule = vi.fn();
  const send = vi.fn();

  try {
    plugin.configureServer!({ watcher: { add } } as never);
    expect(add).toHaveBeenCalledWith(configPath);
    expect(plugin.load?.(resolvedVirtualModuleId)).not.toContain('@yunzhen/cordis-ui-renderer');
    writeFileSync(configPath, '- id: i18n\n  name: \'@yunzhen/cordis-ui-i18n\'\n- id: renderer\n  name: \'@yunzhen/cordis-ui-renderer\'\n');
    plugin.handleHotUpdate!({
      file: configPath,
      server: { moduleGraph: { getModuleById: () => module, invalidateModule }, ws: { send } },
    } as never);

    expect(invalidateModule).toHaveBeenCalledWith(module);
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    expect(plugin.load?.(resolvedVirtualModuleId)).toContain('@yunzhen/cordis-ui-renderer');
  }
  finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it('boots the locale runtime before the UI and its language settings extension', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;
  const ids = entries.map(entry => entry.id);

  expect(ids.indexOf('i18n')).toBeLessThan(ids.indexOf('renderer'));
  expect(ids.indexOf('settings-layout')).toBeLessThan(ids.indexOf('settings-general'));
  expect(ids.indexOf('settings-general')).toBeLessThan(ids.indexOf('settings-language'));
});

it('boots models before chat', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;
  const ids = entries.map(entry => entry.id);

  expect(ids.indexOf('models')).toBeGreaterThanOrEqual(0);
  expect(ids.indexOf('chat')).toBeGreaterThan(ids.indexOf('models'));
});

it('boots the model settings extension after the models runtime', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;
  const ids = entries.map(entry => entry.id);

  expect(ids.indexOf('settings-models')).toBeGreaterThan(ids.indexOf('models'));
});

it('declares direct UI runtime dependencies in plugin manifests', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;
  const injectFor = (id: string) => entries.find(entry => entry.id === id)?.inject ?? [];

  expect(injectFor('dashboard')).toEqual(expect.arrayContaining([
    '@yunzhen/cordis-ui-layout',
    '@yunzhen/cordis-ui-renderer',
    '@yunzhen/cordis-ui-router',
  ]));
  expect(injectFor('settings-layout')).toContain('@yunzhen/cordis-ui-renderer');
  expect(injectFor('settings-general')).toContain('@yunzhen/cordis-ui-renderer');
  expect(injectFor('settings-language')).toContain('@yunzhen/cordis-ui-renderer');
});
