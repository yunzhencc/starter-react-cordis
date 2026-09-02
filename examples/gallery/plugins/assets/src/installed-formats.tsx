import type { FormatExtension, FormatRegistry, GalleryPluginApi, InstalledGalleryPlugin, PluginFormatDescriptor, Thumbnail } from '@yunzhen/gallery-formats';
import { useEffect, useRef } from 'react';

const DECODE_TIMEOUT_MS = 30_000;
const MAX_THUMBNAIL_EDGE = 400;

// The controller and its viewer share the same short-lived plugin descriptor lifecycle.
// eslint-disable-next-line react-refresh/only-export-components
export class InstalledFormatController {
  private readonly unregister = new Map<string, () => void>();

  constructor(
    private readonly formats: FormatRegistry,
    private readonly plugins: GalleryPluginApi,
  ) {}

  async refresh() {
    const installed = await this.plugins.list();
    const next = new Map(installed.filter(plugin => plugin.enabled).flatMap(plugin => plugin.formats.map(format => [key(plugin, format), { format, plugin }] as const)));
    for (const [id, dispose] of this.unregister) {
      if (!next.has(id)) {
        dispose();
        this.unregister.delete(id);
      }
    }
    for (const [id, descriptor] of next) {
      if (!this.unregister.has(id))
        this.unregister.set(id, this.formats.register(createInstalledExtension(descriptor.plugin, descriptor.format)));
    }
  }

  dispose() {
    for (const dispose of this.unregister.values()) dispose();
    this.unregister.clear();
  }
}

function createInstalledExtension(plugin: InstalledGalleryPlugin, descriptor: PluginFormatDescriptor): FormatExtension {
  return {
    Viewer: ({ name, source }) => <InstalledPluginViewer descriptor={descriptor} name={name} plugin={plugin} source={source} />,
    createThumbnail: source => createSandboxThumbnail(plugin, descriptor, source),
    extensions: [descriptor.extension],
    id: `${plugin.id}:${descriptor.extension}`,
    version: plugin.version,
  };
}

export function InstalledPluginViewer({ descriptor, name, plugin, source }: { descriptor: PluginFormatDescriptor; name: string; plugin: InstalledGalleryPlugin; source: Uint8Array }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const send = () => frameRef.current?.contentWindow?.postMessage({ bytes: Uint8Array.from(source).buffer, name, type: 'gallery-plugin:asset' }, '*', [Uint8Array.from(source).buffer]);
    const element = frameRef.current;
    element?.addEventListener('load', send, { once: true });
    return () => element?.removeEventListener('load', send);
  }, [name, source]);
  return <iframe ref={frameRef} sandbox="allow-scripts" src={pluginUrl(plugin, descriptor.viewer)} title={`${name} preview`} />;
}

function createSandboxThumbnail(plugin: InstalledGalleryPlugin, descriptor: PluginFormatDescriptor, source: Uint8Array): Promise<Thumbnail> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const port = new MessageChannel();
    let timeout: ReturnType<typeof setTimeout>;
    const dispose = () => {
      clearTimeout(timeout);
      port.port1.close();
      frame.remove();
    };
    port.port1.onmessage = ({ data }) => {
      dispose();
      if (!(data?.bytes instanceof ArrayBuffer) || (data.mimeType !== 'image/png' && data.mimeType !== 'image/webp'))
        reject(new Error('format plugin returned an invalid thumbnail'));
      else
        resolve({ bytes: new Uint8Array(data.bytes), mimeType: data.mimeType });
    };
    frame.hidden = true;
    frame.sandbox.add('allow-scripts');
    frame.src = `gallery-plugin://${plugin.id}/__host/thumbnail-runner.html`;
    frame.onload = () => {
      const bytes = Uint8Array.from(source);
      frame.contentWindow?.postMessage({ type: 'gallery-plugin:thumbnail-runner', workerUrl: pluginUrl(plugin, descriptor.thumbnailWorker) }, '*', [port.port2]);
      port.port1.postMessage({ bytes: bytes.buffer, id: crypto.randomUUID(), maxEdge: MAX_THUMBNAIL_EDGE }, [bytes.buffer]);
    };
    timeout = setTimeout(() => {
      dispose();
      reject(new Error('format plugin thumbnail timed out after 30 seconds'));
    }, DECODE_TIMEOUT_MS);
    document.body.append(frame);
  });
}

function key(plugin: InstalledGalleryPlugin, descriptor: PluginFormatDescriptor) {
  return `${plugin.id}:${descriptor.extension}`;
}

function pluginUrl(plugin: InstalledGalleryPlugin, path: string) {
  return `gallery-plugin://${plugin.id}/${path}`;
}
