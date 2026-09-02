import type { AssetRecord, Thumbnail } from '@yunzhen/gallery-formats';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.jxl']);
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;

interface MediaLibraryOptions {
  cacheRoot: string;
  configPath: string;
  root?: string;
}

interface AssetEntry {
  asset: AssetRecord;
  path: string;
}

interface MediaLibraryConfig {
  root: string;
}

export class MediaLibrary {
  private assets = new Map<string, AssetEntry>();
  private root: string | undefined;

  private constructor(
    private readonly cacheRoot: string,
    private readonly configPath: string,
    root?: string,
  ) {
    this.root = root && resolve(root);
  }

  static async create(options: MediaLibraryOptions) {
    const root = options.root ?? await readConfiguredRoot(options.configPath);
    return new MediaLibrary(options.cacheRoot, options.configPath, root);
  }

  async listAssets(): Promise<readonly AssetRecord[]> {
    const entries: AssetEntry[] = [];
    if (this.root)
      await this.scanDirectory(this.root, entries);

    entries.sort((left, right) => right.asset.modifiedAt - left.asset.modifiedAt);
    this.assets = new Map(entries.map(entry => [entry.asset.id, entry]));
    return entries.map(entry => entry.asset);
  }

  async readAsset(id: string): Promise<Uint8Array> {
    const entry = this.getAsset(id);
    return readFile(entry.path);
  }

  async readThumbnail(id: string, processor: string): Promise<Thumbnail | undefined> {
    const entry = this.getAsset(id);
    const path = this.getCachePath(entry, processor);
    try {
      const cached = JSON.parse(await readFile(path, 'utf8')) as Partial<{
        bytesBase64: string;
        mimeType: string;
      }>;
      if (!isThumbnailMimeType(cached.mimeType) || typeof cached.bytesBase64 !== 'string')
        return undefined;
      return {
        bytes: new Uint8Array(Buffer.from(cached.bytesBase64, 'base64')),
        mimeType: cached.mimeType,
      };
    }
    catch {
      return undefined;
    }
  }

  async writeThumbnail(id: string, processor: string, thumbnail: Thumbnail): Promise<void> {
    const entry = this.getAsset(id);
    if (!isThumbnailMimeType(thumbnail?.mimeType))
      throw new Error('unsupported thumbnail mime type');
    if (!(thumbnail.bytes instanceof Uint8Array))
      throw new TypeError('thumbnail bytes must be a Uint8Array');
    if (thumbnail.bytes.byteLength > MAX_THUMBNAIL_SIZE)
      throw new Error('thumbnail exceeds 10 MiB');

    await mkdir(this.cacheRoot, { recursive: true });
    await writeFile(this.getCachePath(entry, processor), JSON.stringify({
      bytesBase64: Buffer.from(thumbnail.bytes).toString('base64'),
      mimeType: thumbnail.mimeType,
    }));
  }

  async setRoot(root: string): Promise<readonly AssetRecord[]> {
    const nextRoot = resolve(root);
    const stats = await lstat(nextRoot);
    if (stats.isSymbolicLink() || !stats.isDirectory())
      throw new Error('media root must be a real directory');

    this.root = nextRoot;
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify({ root: nextRoot } satisfies MediaLibraryConfig));
    return this.listAssets();
  }

  private getAsset(id: string) {
    const entry = this.assets.get(id);
    if (!entry)
      throw new Error(`unknown asset: ${id}`);
    return entry;
  }

  private getCachePath(entry: AssetEntry, processor: string) {
    const { extension, modifiedAt, size } = entry.asset;
    const key = hash([entry.path, size, modifiedAt, extension, processor].join('\0'));
    return join(this.cacheRoot, `${key}.json`);
  }

  private async scanDirectory(directory: string, entries: AssetEntry[]): Promise<void> {
    let directoryStats;
    try {
      directoryStats = await lstat(directory);
    }
    catch {
      return;
    }
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory())
      return;

    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    }
    catch {
      return;
    }

    for (const child of children) {
      const path = join(directory, child.name);
      let stats;
      try {
        stats = await lstat(path);
      }
      catch {
        continue;
      }
      if (stats.isSymbolicLink())
        continue;
      if (stats.isDirectory()) {
        await this.scanDirectory(path, entries);
        continue;
      }
      if (!stats.isFile())
        continue;

      const extension = extname(child.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension))
        continue;

      const relativePath = relative(this.root!, path);
      entries.push({
        asset: {
          extension,
          id: hash(relativePath),
          modifiedAt: stats.mtimeMs,
          name: child.name,
          size: stats.size,
        },
        path,
      });
    }
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isThumbnailMimeType(value: unknown): value is Thumbnail['mimeType'] {
  return value === 'image/png' || value === 'image/webp';
}

async function readConfiguredRoot(configPath: string) {
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Partial<MediaLibraryConfig>;
    return typeof config.root === 'string' ? config.root : undefined;
  }
  catch {
    return undefined;
  }
}
