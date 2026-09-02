import type { AssetRecord, Thumbnail } from '@yunzhen/gallery-formats';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, mkdir, open, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.jxl']);
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;

interface MediaLibraryOptions {
  cacheRoot: string;
  configPath: string;
  root?: string;
}

interface AssetEntry {
  asset: AssetRecord;
  identity: FileIdentity;
  path: string;
  root: RootIdentity;
}

interface FileIdentity {
  dev: number;
  ino: number;
  modifiedAt: number;
  size: number;
}

interface RootIdentity {
  dev: number;
  ino: number;
  path: string;
  realPath: string;
}

interface MediaLibraryConfig {
  root: string;
}

export class MediaLibrary {
  private assets = new Map<string, AssetEntry>();
  private operation = Promise.resolve();
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
    return this.runExclusive(() => this.scanAssets());
  }

  async readAsset(id: string): Promise<Uint8Array> {
    return this.runExclusive(async () => {
      const entry = this.getAsset(id);
      return this.readVerifiedAsset(entry);
    });
  }

  async readThumbnail(id: string, processor: string): Promise<Thumbnail | undefined> {
    return this.runExclusive(async () => {
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
    });
  }

  async writeThumbnail(id: string, processor: string, thumbnail: Thumbnail): Promise<void> {
    return this.runExclusive(async () => {
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
    });
  }

  async setRoot(root: string): Promise<readonly AssetRecord[]> {
    return this.runExclusive(async () => {
      const nextRoot = resolve(root);
      const stats = await lstat(nextRoot);
      if (stats.isSymbolicLink() || !stats.isDirectory())
        throw new Error('media root must be a real directory');

      await mkdir(dirname(this.configPath), { recursive: true });
      await writeFile(this.configPath, JSON.stringify({ root: nextRoot } satisfies MediaLibraryConfig));
      this.root = nextRoot;
      return this.scanAssets();
    });
  }

  private async scanAssets() {
    const entries: AssetEntry[] = [];
    const root = this.root && await readRootIdentity(this.root);
    if (root)
      await this.scanDirectory(root.path, root, entries);

    entries.sort((left, right) => right.asset.modifiedAt - left.asset.modifiedAt);
    this.assets = new Map(entries.map(entry => [entry.asset.id, entry]));
    return entries.map(entry => entry.asset);
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

  private runExclusive<T>(operation: () => Promise<T>) {
    const result = this.operation.then(operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readVerifiedAsset(entry: AssetEntry) {
    const handle = await open(entry.path, 'r').catch(() => undefined);
    if (!handle)
      throw new Error(`asset is no longer available: ${entry.asset.id}`);

    try {
      const [fileStats, rootStats, currentRootPath, currentFilePath] = await Promise.all([
        handle.stat(),
        lstat(entry.root.path),
        realpath(entry.root.path),
        realpath(entry.path),
      ]);
      const rootMatches = this.root === entry.root.path
        && rootStats.isDirectory()
        && !rootStats.isSymbolicLink()
        && rootStats.dev === entry.root.dev
        && rootStats.ino === entry.root.ino
        && currentRootPath === entry.root.realPath;
      const fileMatches = fileStats.isFile()
        && fileStats.dev === entry.identity.dev
        && fileStats.ino === entry.identity.ino
        && fileStats.size === entry.identity.size
        && fileStats.mtimeMs === entry.identity.modifiedAt;
      if (!rootMatches || !fileMatches || !isPathInside(currentRootPath, currentFilePath))
        throw new Error('stale asset');
      return await handle.readFile();
    }
    catch {
      throw new Error(`asset is no longer available: ${entry.asset.id}`);
    }
    finally {
      await handle.close();
    }
  }

  private async scanDirectory(directory: string, root: RootIdentity, entries: AssetEntry[]): Promise<void> {
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
        await this.scanDirectory(path, root, entries);
        continue;
      }
      if (!stats.isFile())
        continue;

      const extension = extname(child.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension))
        continue;
      if ((stats.mode & 0o444) === 0)
        continue;
      try {
        await access(path, constants.R_OK);
      }
      catch {
        continue;
      }

      const relativePath = relative(root.path, path);
      entries.push({
        asset: {
          extension,
          id: hash(relativePath),
          modifiedAt: stats.mtimeMs,
          name: child.name,
          size: stats.size,
        },
        identity: {
          dev: stats.dev,
          ino: stats.ino,
          modifiedAt: stats.mtimeMs,
          size: stats.size,
        },
        path,
        root,
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

async function readRootIdentity(path: string): Promise<RootIdentity | undefined> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || !stats.isDirectory())
      return undefined;
    return {
      dev: stats.dev,
      ino: stats.ino,
      path,
      realPath: await realpath(path),
    };
  }
  catch {
    return undefined;
  }
}

function isPathInside(root: string, path: string) {
  const relativePath = relative(root, path);
  return relativePath !== ''
    && relativePath !== '..'
    && !relativePath.startsWith(`..${sep}`)
    && !isAbsolute(relativePath);
}
