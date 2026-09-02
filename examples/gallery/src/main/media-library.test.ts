import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  return { cacheRoot, configPath, root };
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
