import type { GalleryFormatPluginManifest, InstalledGalleryPlugin, PluginFormatDescriptor } from '@yunzhen/gallery-formats';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as yauzl from 'yauzl';

const MAX_ARCHIVE_ENTRIES = 200;
const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

interface FormatPluginManagerOptions {
  configPath: string;
  pluginsRoot: string;
}

interface PluginConfig {
  plugins: InstalledGalleryPlugin[];
}

export class FormatPluginManager {
  private plugins: InstalledGalleryPlugin[];

  private constructor(
    private readonly configPath: string,
    private readonly pluginsRoot: string,
    plugins: InstalledGalleryPlugin[],
  ) {
    this.plugins = plugins;
  }

  static async create(options: FormatPluginManagerOptions) {
    await mkdir(options.pluginsRoot, { recursive: true });
    return new FormatPluginManager(options.configPath, options.pluginsRoot, await readConfig(options.configPath));
  }

  async list(): Promise<readonly InstalledGalleryPlugin[]> {
    return this.plugins;
  }

  async install(zipPath: string): Promise<InstalledGalleryPlugin> {
    const temporaryRoot = await mkdtemp(join(this.pluginsRoot, '.install-'));
    try {
      await extractZip(zipPath, temporaryRoot);
      const plugin = await readManifest(temporaryRoot);
      if (this.plugins.some(candidate => candidate.id === plugin.id))
        throw new Error(`format plugin is already installed: ${plugin.id}`);
      if (plugin.formats.some(format => this.plugins.some(candidate => candidate.enabled && candidate.formats.some(existing => existing.extension === format.extension)))) {
        const collision = plugin.formats.find(format => this.plugins.some(candidate => candidate.enabled && candidate.formats.some(existing => existing.extension === format.extension)));
        throw new Error(`format extension already enabled: ${collision?.extension}`);
      }

      await assertDeclaredFiles(temporaryRoot, plugin.formats);
      const destination = join(this.pluginsRoot, plugin.id);
      await rename(temporaryRoot, destination);
      this.plugins = [...this.plugins, plugin];
      await this.writeConfig();
      return plugin;
    }
    catch (error) {
      await rm(temporaryRoot, { force: true, recursive: true });
      throw error;
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<readonly InstalledGalleryPlugin[]> {
    const plugin = this.plugins.find(candidate => candidate.id === id);
    if (!plugin)
      throw new Error(`unknown format plugin: ${id}`);
    if (plugin.enabled === enabled)
      return this.plugins;
    if (enabled) {
      for (const format of plugin.formats) {
        if (this.plugins.some(candidate => candidate.enabled && candidate.id !== id && candidate.formats.some(existing => existing.extension === format.extension)))
          throw new Error(`format extension already enabled: ${format.extension}`);
      }
    }
    this.plugins = this.plugins.map(candidate => candidate.id === id ? { ...candidate, enabled } : candidate);
    await this.writeConfig();
    return this.plugins;
  }

  async uninstall(id: string): Promise<readonly InstalledGalleryPlugin[]> {
    const plugin = this.plugins.find(candidate => candidate.id === id);
    if (!plugin)
      throw new Error(`unknown format plugin: ${id}`);
    const next = this.plugins.filter(candidate => candidate !== plugin);
    const previous = this.plugins;
    this.plugins = next;
    try {
      await rm(join(this.pluginsRoot, plugin.id), { force: true, recursive: true });
      await this.writeConfig();
      return this.plugins;
    }
    catch (error) {
      this.plugins = previous;
      throw error;
    }
  }

  async resolveResource(id: string, resource: string) {
    const plugin = this.plugins.find(candidate => candidate.id === id && candidate.enabled);
    if (!plugin || !isAllowedResource(plugin, resource))
      return undefined;
    const path = resolve(this.pluginsRoot, plugin.id, resource);
    return isPathInside(join(this.pluginsRoot, plugin.id), path) ? path : undefined;
  }

  private async writeConfig() {
    await mkdir(resolve(this.configPath, '..'), { recursive: true });
    await writeFile(this.configPath, JSON.stringify({ plugins: this.plugins } satisfies PluginConfig));
  }
}

async function extractZip(zipPath: string, destination: string) {
  const zip = await new Promise<yauzl.ZipFile>((resolveZip, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true }, (error, opened) => error || !opened ? reject(error ?? new Error('failed to open format plugin ZIP')) : resolveZip(opened));
  });
  let entries = 0;
  let totalSize = 0;
  try {
    await new Promise<void>((resolveEntries, reject) => {
      zip.on('error', reject);
      zip.on('entry', (entry: yauzl.Entry) => {
        entries += 1;
        totalSize += entry.uncompressedSize;
        const unsafeName = yauzl.validateFileName(entry.fileName);
        const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (entries > MAX_ARCHIVE_ENTRIES || totalSize > MAX_ARCHIVE_SIZE || unsafeName || unixMode === 0o120000 || !isSafeRelativePath(entry.fileName)) {
          reject(new Error(`unsafe format plugin ZIP entry: ${entry.fileName}`));
          return;
        }
        if (entry.fileName.endsWith('/')) {
          void mkdir(join(destination, entry.fileName), { recursive: true }).then(() => zip.readEntry(), reject);
          return;
        }
        const target = join(destination, entry.fileName);
        void mkdir(resolve(target, '..'), { recursive: true })
          .then(() => new Promise<void>((resolveStream, rejectStream) => {
            zip.openReadStream(entry, (error, stream) => {
              if (error || !stream) {
                rejectStream(error ?? new Error(`cannot read ZIP entry: ${entry.fileName}`));
                return;
              }
              void pipeline(stream, createWriteStream(target)).then(resolveStream, rejectStream);
            });
          }))
          .then(() => zip.readEntry(), reject);
      });
      zip.on('end', resolveEntries);
      zip.readEntry();
    });
  }
  finally {
    zip.close();
  }
}

async function readManifest(root: string): Promise<InstalledGalleryPlugin> {
  const parsed = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as Partial<GalleryFormatPluginManifest>;
  if (parsed.schemaVersion !== 1 || !isPluginId(parsed.id) || typeof parsed.name !== 'string' || !parsed.name || typeof parsed.version !== 'string' || !parsed.version || !parsed.formats || typeof parsed.formats !== 'object')
    throw new Error('invalid format plugin manifest');
  const formats = Object.entries(parsed.formats).map(([extension, value]): PluginFormatDescriptor => {
    if (!isExtension(extension) || !value || typeof value.thumbnailWorker !== 'string' || typeof value.viewer !== 'string' || !isSafeRelativePath(value.thumbnailWorker) || !isSafeRelativePath(value.viewer))
      throw new Error(`invalid format plugin format: ${extension}`);
    return { extension, thumbnailWorker: value.thumbnailWorker, viewer: value.viewer };
  });
  if (!formats.length)
    throw new Error('format plugin must declare a format');
  return { enabled: true, formats, id: parsed.id, name: parsed.name, version: parsed.version };
}

async function assertDeclaredFiles(root: string, formats: readonly PluginFormatDescriptor[]) {
  for (const path of formats.flatMap(format => [format.thumbnailWorker, format.viewer])) {
    const fullPath = resolve(root, path);
    if (!isPathInside(root, fullPath) || !(await lstat(fullPath)).isFile())
      throw new Error(`missing format plugin entry: ${path}`);
  }
}

async function readConfig(path: string) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<PluginConfig>;
    return Array.isArray(parsed.plugins) ? parsed.plugins.filter(isInstalledPlugin) : [];
  }
  catch {
    return [];
  }
}

function isInstalledPlugin(value: unknown): value is InstalledGalleryPlugin {
  return Boolean(value && typeof value === 'object' && isPluginId((value as InstalledGalleryPlugin).id) && Array.isArray((value as InstalledGalleryPlugin).formats));
}

function isAllowedResource(plugin: InstalledGalleryPlugin, resource: string) {
  return plugin.formats.some(format => resource === format.thumbnailWorker || resource === format.viewer) || resource.startsWith('assets/');
}

function isPluginId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(value);
}

function isExtension(value: string) {
  return /^\.[a-z0-9]+$/.test(value);
}

function isSafeRelativePath(path: string) {
  return Boolean(path) && !isAbsolute(path) && normalize(path) === path && !path.startsWith(`..${sep}`) && path !== '..';
}

function isPathInside(root: string, path: string) {
  const relativePath = relative(root, path);
  return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}
