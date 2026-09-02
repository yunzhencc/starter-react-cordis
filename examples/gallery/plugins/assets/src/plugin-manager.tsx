import type { GalleryPluginApi, InstalledGalleryPlugin } from '@yunzhen/gallery-formats';
import type { InstalledFormatController } from './installed-formats';
import type { MediaStore } from './media';
import { useCallback, useEffect, useState } from 'react';

export function FormatPluginManager({ formats, media, plugins }: { formats: InstalledFormatController; media: MediaStore; plugins: GalleryPluginApi }) {
  const [installed, setInstalled] = useState<readonly InstalledGalleryPlugin[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const refresh = useCallback(async () => {
    const next = await plugins.list();
    setInstalled(next);
    await formats.refresh();
    await media.reload();
  }, [formats, media, plugins]);
  useEffect(() => {
    void refresh().catch(error => setError(message(error)));
  }, [refresh]);
  const run = async (id: string, action: () => Promise<unknown>) => {
    setError(undefined);
    setPending(id);
    try {
      await action();
      await refresh();
    }
    catch (error) {
      setError(message(error));
    }
    finally {
      setPending(undefined);
    }
  };
  return (
    <section>
      <button disabled={Boolean(pending)} type="button" onClick={() => run('install', plugins.install)}>安装格式插件</button>
      {error && <p role="alert">{error}</p>}
      {installed.map(plugin => (
        <div key={plugin.id}>
          <span>
            {plugin.name}
            {' '}
            {plugin.version}
          </span>
          <button disabled={Boolean(pending)} type="button" onClick={() => run(plugin.id, () => plugins.setEnabled(plugin.id, !plugin.enabled))}>{plugin.enabled ? `停用 ${plugin.name}` : `启用 ${plugin.name}`}</button>
          <button disabled={Boolean(pending)} type="button" onClick={() => run(plugin.id, () => plugins.uninstall(plugin.id))}>
            卸载
            {plugin.name}
          </button>
        </div>
      ))}
    </section>
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '格式插件操作失败';
}
