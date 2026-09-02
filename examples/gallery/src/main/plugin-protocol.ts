import { readFile } from 'node:fs/promises';

export const PLUGIN_CONTENT_SECURITY_POLICY = 'default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; worker-src \'self\'; connect-src \'none\'; frame-ancestors \'self\'';

export interface PluginResourceResolver {
  resolveResource: (id: string, resource: string) => Promise<string | undefined>;
}

const THUMBNAIL_RUNNER_PATH = '__host/thumbnail-runner.html';
const thumbnailRunner = `<!doctype html><script>
addEventListener('message', ({ data, ports }) => {
  if (data?.type !== 'gallery-plugin:thumbnail-runner' || !ports[0] || typeof data.workerUrl !== 'string') return;
  const port = ports[0];
  const worker = new Worker(data.workerUrl, { type: 'module' });
  const close = () => { worker.terminate(); port.close(); };
  worker.onmessage = ({ data }) => {
    if (!(data?.bytes instanceof ArrayBuffer) || data.bytes.byteLength > 10 * 1024 * 1024 || !['image/png', 'image/webp'].includes(data.mimeType)) return close();
    port.postMessage(data, [data.bytes]);
    close();
  };
  worker.onerror = () => close();
  port.onmessage = ({ data }) => {
    if (!(data?.bytes instanceof ArrayBuffer)) return close();
    worker.postMessage(data, [data.bytes]);
  };
});
</script>`;

export function createPluginProtocolHandler(plugins: PluginResourceResolver) {
  return async (request: Request) => {
    const url = new URL(request.url);
    const resource = decodeURIComponent(url.pathname.slice(1));
    if (resource === THUMBNAIL_RUNNER_PATH)
      return new Response(thumbnailRunner, { headers: { 'Content-Security-Policy': PLUGIN_CONTENT_SECURITY_POLICY, 'Content-Type': 'text/html' } });
    const path = await plugins.resolveResource(url.hostname, resource);
    if (!path)
      return new Response(null, { status: 404 });
    return new Response(await readFile(path), {
      headers: { 'Content-Security-Policy': PLUGIN_CONTENT_SECURITY_POLICY },
    });
  };
}
