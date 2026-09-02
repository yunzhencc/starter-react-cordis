import type { AssetRecord, FormatExtension, FormatRegistry, GalleryMediaApi, Thumbnail } from '@yunzhen/gallery-formats';

const THUMBNAIL_WORKER_COUNT = 4;

export interface AssetItem {
  asset: AssetRecord;
  status: 'loading' | 'ready' | 'error';
  source?: Uint8Array;
  thumbnailUrl?: string;
}

interface OpenedAsset {
  asset: AssetRecord;
  format: FormatExtension;
  source: Uint8Array;
}

export interface MediaSnapshot {
  assets: readonly AssetItem[];
  opened?: OpenedAsset;
  selectedId?: string;
}

export class MediaStore {
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private current: MediaSnapshot = { assets: [] };

  constructor(
    private readonly formats: FormatRegistry,
    private readonly media: GalleryMediaApi,
    private readonly onReplace = () => {},
  ) {}

  snapshot = () => this.current;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  listAssets = async () => {
    try {
      await this.load(await this.media.listAssets());
    }
    catch {
      await this.load([]);
    }
  };

  chooseRoot = async () => {
    try {
      await this.load(await this.media.chooseRoot());
    }
    catch {}
  };

  select = (id: string) => {
    if (!this.current.assets.some(item => item.asset.id === id))
      return;
    this.publish({ ...this.current, selectedId: id });
  };

  open = async (id: string) => {
    this.select(id);
    const item = this.current.assets.find(candidate => candidate.asset.id === id);
    const format = item && this.formats.find(item.asset.extension);
    if (!item || !format)
      return false;

    try {
      const source = item.source ?? await this.media.readAsset(id);
      this.publish({
        ...this.current,
        opened: { asset: item.asset, format, source },
        assets: this.current.assets.map(candidate => candidate.asset.id === id ? { ...candidate, source } : candidate),
      });
      return true;
    }
    catch {
      this.updateItem(id, item => ({ ...item, status: 'error' }));
      return false;
    }
  };

  dispose() {
    this.generation += 1;
    this.revokeThumbnails(this.current.assets);
    this.listeners.clear();
  }

  private async load(records: readonly AssetRecord[]) {
    const generation = ++this.generation;
    const assets = records
      .filter(asset => this.formats.find(asset.extension))
      .map(asset => ({ asset, status: 'loading' as const }));
    this.onReplace();
    this.revokeThumbnails(this.current.assets);
    this.publish({ assets });
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < assets.length) {
        const item = assets[nextIndex++]!;
        await this.loadThumbnail(item.asset, generation);
      }
    };
    await Promise.all(Array.from(
      { length: Math.min(THUMBNAIL_WORKER_COUNT, assets.length) },
      worker,
    ));
  }

  private async loadThumbnail(asset: AssetRecord, generation: number) {
    const format = this.formats.find(asset.extension);
    if (!format)
      return;

    try {
      const processor = `${format.id}@${format.version}`;
      let source: Uint8Array | undefined;
      let thumbnail = await this.media.readThumbnail(asset.id, processor);
      if (!thumbnail) {
        source = await this.media.readAsset(asset.id);
        thumbnail = await format.createThumbnail(source);
        await this.media.writeThumbnail(asset.id, processor, thumbnail);
      }
      if (generation !== this.generation)
        return;
      this.updateItem(asset.id, item => ({
        ...item,
        ...(source ? { source } : {}),
        status: 'ready',
        thumbnailUrl: thumbnailUrl(thumbnail),
      }));
    }
    catch {
      if (generation === this.generation)
        this.updateItem(asset.id, item => ({ ...item, status: 'error' }));
    }
  }

  private updateItem(id: string, update: (item: AssetItem) => AssetItem) {
    this.publish({
      ...this.current,
      assets: this.current.assets.map(item => item.asset.id === id ? update(item) : item),
    });
  }

  private publish(snapshot: MediaSnapshot) {
    this.current = snapshot;
    for (const listener of [...this.listeners]) listener();
  }

  private revokeThumbnails(assets: readonly AssetItem[]) {
    for (const item of assets) {
      if (item.thumbnailUrl)
        URL.revokeObjectURL(item.thumbnailUrl);
    }
  }
}

function thumbnailUrl(thumbnail: Thumbnail) {
  return URL.createObjectURL(new Blob([Uint8Array.from(thumbnail.bytes).buffer], { type: thumbnail.mimeType }));
}
