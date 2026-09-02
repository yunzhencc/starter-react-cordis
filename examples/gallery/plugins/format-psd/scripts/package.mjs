import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ZipFile } from 'yazl';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/psd.gallery-plugin.zip');
const files = [['manifest.json', resolve(root, 'manifest.json')]];
for (const relativePath of await readdir(resolve(root, 'dist'), { recursive: true })) {
  if (relativePath.endsWith('.zip'))
    continue;
  const source = resolve(root, 'dist', relativePath);
  if ((await stat(source)).isFile())
    files.push([relativePath === 'src/viewer.html' ? 'viewer/psd.html' : relativePath, source]);
}
for (const [, file] of files) await access(file);
await mkdir(dirname(output), { recursive: true });
const zip = new ZipFile();
for (const [path, file] of files) zip.addBuffer(await readFile(file), path);
zip.end();
await new Promise((resolve, reject) => zip.outputStream.pipe(createWriteStream(output)).on('error', reject).on('close', resolve));
