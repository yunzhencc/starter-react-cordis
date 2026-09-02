import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it } from 'vitest';
import { emitWebBootGraph, renderWebBootVirtualModule } from './vite-plugin';

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

it('boots the locale runtime before the UI and its language settings extension', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;
  const ids = entries.map(entry => entry.id);

  expect(ids.indexOf('i18n')).toBeLessThan(ids.indexOf('renderer'));
  expect(ids.indexOf('settings-layout')).toBeLessThan(ids.indexOf('settings-general'));
  expect(ids.indexOf('settings-general')).toBeLessThan(ids.indexOf('settings-language'));
});
