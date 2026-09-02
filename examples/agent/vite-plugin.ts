import type { WebBootGraph } from '@yunzhen/cordis-client-modules';
import type { Plugin, PluginContext } from 'vite';
import { resolve } from 'node:path';
import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog';

const virtualModuleId = 'virtual:cordis-example-agent-boot';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

export function renderWebBootVirtualModule(graph: WebBootGraph) {
  const loaders = graph.entries.map((entry, index) => `const load${index} = () => import('${entry.name}/client');`).join('\n');
  const registry = graph.entries.map((entry, index) => `  ['${entry.name}', load${index}],`).join('\n');
  return `${loaders}\nexport const graph = ${JSON.stringify(graph)};\nexport const registry = new Map([\n${registry}\n]);\n`;
}

export function emitWebBootGraph(bundle: Pick<PluginContext, 'emitFile'>, graph: WebBootGraph) {
  bundle.emitFile({ fileName: 'cordis.boot.json', source: JSON.stringify(graph, null, 2), type: 'asset' });
}

export function cordisWebBoot(configPath = resolve(import.meta.dirname, 'cordis.yml')): Plugin {
  let graph: WebBootGraph | undefined;
  const loadGraph = () => graph ??= loadWebBootGraph(configPath);

  return {
    name: 'cordis-example-agent-boot',
    buildStart() {
      loadGraph();
    },
    generateBundle() {
      emitWebBootGraph(this, loadGraph());
    },
    load(id) {
      if (id === resolvedVirtualModuleId)
        return renderWebBootVirtualModule(loadGraph());
    },
    resolveId(id) {
      if (id === virtualModuleId)
        return resolvedVirtualModuleId;
    },
  };
}
