import { bootWebApp } from '@yunzhen/cordis-client-modules';
import { graph, registry } from 'virtual:cordis-web-boot';

void bootWebApp({
  container: document.getElementById('root')!,
  graph,
  registry,
}).catch(error => console.error(error));
