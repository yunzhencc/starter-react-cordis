import type { GalleryFormatPluginManifest } from '@yunzhen/gallery-formats';
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { FormatPluginManager } from './format-plugin-manager';

const roots: string[] = [];
const worker = 'self.onmessage = () => {}';
const viewer = '<!doctype html><title>PSD</title>';

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })));
});

it('installs a valid plugin atomically and persists its enabled descriptor', async () => {
  const paths = await fixture();
  const zipPath = await createPluginZip(paths.root, manifest());
  const manager = await FormatPluginManager.create(paths);

  await expect(manager.install(zipPath)).resolves.toMatchObject({ id: 'com.example.psd', enabled: true });
  await expect(manager.list()).resolves.toEqual([expect.objectContaining({ id: 'com.example.psd', enabled: true })]);
  await expect(FormatPluginManager.create(paths).then(next => next.list()))
    .resolves
    .toEqual([expect.objectContaining({ id: 'com.example.psd', enabled: true })]);
});

it.each([
  ['../escape.js', 'viewer/psd.html'],
  ['/absolute.js', 'viewer/psd.html'],
  ['thumbnail/missing.js', 'viewer/psd.html'],
])('rejects unsafe or missing declared entries: %s', async (thumbnailWorker, viewerPath) => {
  const paths = await fixture();
  const manager = await FormatPluginManager.create(paths);
  const zipPath = await createPluginZip(paths.root, manifest({
    formats: { '.psd': { thumbnailWorker, viewer: viewerPath } },
  }));

  await expect(manager.install(zipPath)).rejects.toThrow();
  await expect(manager.list()).resolves.toEqual([]);
});

it('rejects a second enabled plugin that claims .psd and keeps the first enabled', async () => {
  const paths = await fixture();
  const manager = await FormatPluginManager.create(paths);
  await manager.install(await createPluginZip(paths.root, manifest({ id: 'first.psd' })));

  await expect(manager.install(await createPluginZip(paths.root, manifest({ id: 'second.psd' })))).rejects.toThrow('format extension already enabled: .psd');
  await expect(manager.list()).resolves.toEqual([expect.objectContaining({ id: 'first.psd', enabled: true })]);
});

it('allows declared viewer and worker resources but never manifest files', async () => {
  const paths = await fixture();
  const manager = await FormatPluginManager.create(paths);
  await manager.install(await createPluginZip(paths.root, manifest()));
  const viewerPath = await manager.resolveResource('com.example.psd', 'viewer/psd.html');
  if (!viewerPath)
    throw new Error('expected declared viewer resource');

  await expect(readFile(viewerPath, 'utf8')).resolves.toBe(viewer);
  await expect(manager.resolveResource('com.example.psd', 'viewer/psd.js')).resolves.toBeDefined();
  await expect(manager.resolveResource('com.example.psd', 'manifest.json')).resolves.toBeUndefined();
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cordis-format-plugin-'));
  roots.push(root);
  const pluginsRoot = join(root, 'plugins');
  await mkdir(pluginsRoot);
  return { configPath: join(root, 'plugins.json'), pluginsRoot, root };
}

function manifest(overrides: Partial<GalleryFormatPluginManifest & { formats: Record<string, { thumbnailWorker: string; viewer: string }> }> = {}) {
  return {
    formats: { '.psd': { thumbnailWorker: 'thumbnail/psd.worker.js', viewer: 'viewer/psd.html' } },
    id: 'com.example.psd',
    name: 'PSD Format',
    schemaVersion: 1 as const,
    version: '1.0.0',
    ...overrides,
  } satisfies GalleryFormatPluginManifest;
}

async function createPluginZip(root: string, plugin: GalleryFormatPluginManifest) {
  const zipPath = join(root, `${plugin.id}.zip`);
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify(plugin)), 'manifest.json');
  zip.addBuffer(Buffer.from(worker), 'thumbnail/psd.worker.js');
  zip.addBuffer(Buffer.from(viewer), 'viewer/psd.html');
  zip.addBuffer(Buffer.from(worker), 'viewer/psd.js');
  zip.end();
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.on('data', chunk => chunks.push(chunk));
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', resolve);
  });
  await writeFile(zipPath, Buffer.concat(chunks));
  return zipPath;
}
