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
