import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it } from 'vitest';

it('contains only the base Cordis runtime', () => {
  const graph = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname);

  expect(graph.entries.map(entry => entry.id)).toEqual(['i18n', 'renderer', 'router', 'layout', 'theme']);
});
