import type { PluginCatalogProvider, WebBootGraph } from './index';
import { expectTypeOf, it } from 'vitest';

it('models a DeepSeek-compatible boot graph', () => {
  const graph: WebBootGraph = {
    revision: 'r1',
    entries: [{ id: '@yunzhen/cordis-ui-layout', url: '/plugins/layout.js?rev=r1', rev: 'r1', inject: ['@yunzhen/cordis-ui-router'] }],
  };
  const provider: PluginCatalogProvider = { id: 'static', snapshot: async () => graph };
  expectTypeOf(provider.snapshot).returns.toEqualTypeOf<Promise<WebBootGraph>>();
});
