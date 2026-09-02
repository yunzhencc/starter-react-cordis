import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it } from 'vitest';

it('boots the base Cordis runtime and the home plugin', () => {
  const graph = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname);

  expect(graph.entries.map(entry => entry.id)).toEqual(['i18n', 'renderer', 'layout', 'router', 'theme', 'home']);
});
