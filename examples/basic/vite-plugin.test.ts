import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';
import { expect, it } from 'vitest';

it('boots the static example without the router host', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries;

  expect(entries.map(entry => entry.name)).toEqual([
    '@yunzhen/cordis-ui-i18n',
    '@yunzhen/cordis-ui-renderer',
    '@yunzhen/cordis-ui-layout',
    '@examples/basic-page',
  ]);
});
