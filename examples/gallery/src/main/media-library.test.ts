import { chmod, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { MediaLibrary } from './media-library';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'cordis-gallery-'));
  roots.push(temporaryRoot);
  const root = join(temporaryRoot, 'assets');
  const cacheRoot = join(temporaryRoot, 'cache');
  const configPath = join(temporaryRoot, 'gallery.json');
  await mkdir(root);
  return { cacheRoot, configPath, root, temporaryRoot };
}

it('scans supported files recursively but skips symlinks', async () => {
  const { cacheRoot, configPath, root } = await fixture();
  await writeFile(join(root, 'a.png'), 'png');
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested', 'b.jxl'), 'jxl');
  await symlink(join(root, 'a.png'), join(root, 'linked.webp'));
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });

  expect((await library.listAssets()).map(asset => asset.name)).toEqual(['b.jxl', 'a.png']);
});

it('rejects a read for an id not returned by the current scan', async () => {
  const { cacheRoot, configPath, root } = await fixture();
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });

  await expect(library.readAsset('outside-root')).rejects.toThrow('unknown asset');
});

it('misses cache after a processor-version change', async () => {
  const { cacheRoot, configPath, root } = await fixture();
  await writeFile(join(root, 'a.png'), 'png');
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });
  const asset = (await library.listAssets()).at(0);
  if (!asset)
    throw new Error('expected scanned asset');
  const thumbnail = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' as const };

  await library.writeThumbnail(asset.id, 'native@1', thumbnail);

  expect(await library.readThumbnail(asset.id, 'native@2')).toBeUndefined();
});

it('keeps concurrent scans from replacing the current root asset map', async () => {
  const { cacheRoot, configPath, root, temporaryRoot } = await fixture();
  const nextRoot = join(temporaryRoot, 'next-assets');
  await mkdir(nextRoot);
  await writeFile(join(nextRoot, 'current.png'), 'current');
  await Promise.all(Array.from({ length: 256 }, (_, index) => writeFile(join(root, `${index}.png`), 'stale')));
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });

  const staleScan = library.listAssets();
  const switchRoot = library.setRoot(nextRoot);
  const [, currentAssets] = await Promise.all([staleScan, switchRoot]);
  const currentAsset = currentAssets.at(0);
  if (!currentAsset)
    throw new Error('expected current root asset');

  expect(currentAssets.map(asset => asset.name)).toEqual(['current.png']);
  await expect(library.readAsset(currentAsset.id).then(bytes => new TextDecoder().decode(bytes))).resolves.toBe('current');
});

it('rejects an asset whose ancestor becomes a symlink after scanning', async () => {
  const { cacheRoot, configPath, root, temporaryRoot } = await fixture();
  const nested = join(root, 'nested');
  const movedOutsideRoot = join(temporaryRoot, 'moved');
  await mkdir(nested);
  await writeFile(join(nested, 'a.png'), 'outside');
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });
  const asset = (await library.listAssets()).at(0);
  if (!asset)
    throw new Error('expected scanned asset');

  await rename(nested, movedOutsideRoot);
  await symlink(movedOutsideRoot, nested);

  await expect(library.readAsset(asset.id)).rejects.toThrow();
});

it('skips unreadable regular files during the scan', async () => {
  const { cacheRoot, configPath, root } = await fixture();
  await writeFile(join(root, 'readable.png'), 'readable');
  const unreadablePath = join(root, 'unreadable.webp');
  await writeFile(unreadablePath, 'unreadable');
  await chmod(unreadablePath, 0o000);
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });

  expect((await library.listAssets()).map(asset => asset.name)).toEqual(['readable.png']);
});

it('keeps the previous root when root config persistence fails', async () => {
  const { cacheRoot, root, temporaryRoot } = await fixture();
  await writeFile(join(root, 'previous.png'), 'previous');
  const blockedConfigParent = join(temporaryRoot, 'blocked-config');
  await writeFile(blockedConfigParent, 'not a directory');
  const library = await MediaLibrary.create({
    cacheRoot,
    configPath: join(blockedConfigParent, 'gallery.json'),
    root,
  });
  const previousAsset = (await library.listAssets()).at(0);
  if (!previousAsset)
    throw new Error('expected previous root asset');
  const nextRoot = join(temporaryRoot, 'next-root');
  await mkdir(nextRoot);
  await writeFile(join(nextRoot, 'next.png'), 'next');

  await expect(library.setRoot(nextRoot)).rejects.toThrow();

  expect((await library.listAssets()).map(asset => asset.name)).toEqual(['previous.png']);
  await expect(library.readAsset(previousAsset.id).then(bytes => new TextDecoder().decode(bytes))).resolves.toBe('previous');
});
