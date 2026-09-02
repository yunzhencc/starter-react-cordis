import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it } from 'vitest';
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
  const plugin = cordisWebBoot({ virtualModuleId: 'virtual:cordis-eagle-boot' });

  expect(plugin.resolveId?.('virtual:cordis-eagle-boot')).toBe('\0virtual:cordis-eagle-boot');
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
