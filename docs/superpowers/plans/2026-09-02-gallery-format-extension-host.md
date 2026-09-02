# Gallery 格式扩展宿主 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Gallery 选择一个本地目录，展示 PNG/JPEG/WebP/JXL 素材，并在右侧 workbench 预览；JXL 通过静态内置格式扩展接入。

**Architecture:** 主进程拥有目录选择、递归扫描、文件读取与缩略图缓存，preload 只暴露按资产 id 操作的 IPC。浏览器端 FormatRegistry 是一个小型 Cordis 服务：原生图片与 JXL 包各自静态注册处理器，assets 页面只消费处理器和素材 API 来渲染网格及 workbench。

**Tech Stack:** Electron 44、Cordis 4、React 19、@egjs/react-infinitegrid、浏览器 Canvas、@jsquash/jxl 1.3.0（Apache-2.0，WASM）。

**Spec:** docs/superpowers/specs/2026-09-02-gallery-format-extension-host-design.md

## Global Constraints

- 首版只允许静态构建期注册的内置格式扩展；不得实现运行时安装、远程模块或插件商店。
- 本地素材根目录只能由主进程选择并持久化；renderer 不传入任意文件路径。
- 支持 .png、.jpg、.jpeg、.webp、.jxl，递归扫描时跳过符号链接与不可读项。
- @examples/gallery-assets 继续是主内容区页面；预览只占用已有 workbench Slot。
- 缩略图缓存位于 Electron userData，缓存键必须包含路径、大小、修改时间、扩展名和格式处理器版本。
- JXL 使用 @jsquash/jxl@1.3.0，不复制 Eagle 插件源码或其未声明许可证的二进制文件。

---

## File Structure

| 文件 | 责任 |
| --- | --- |
| packages/gallery/formats/src/index.ts | 跨进程 DTO、FormatRegistry Cordis 服务和格式处理器类型。 |
| examples/gallery/src/main/media-library.ts | 主进程目录持久化、扫描、记录授权、缓存读写。 |
| examples/gallery/src/main/index.ts | 原生目录选择与严格 IPC handler 注册。 |
| examples/gallery/src/preload/index.ts | 通过 contextBridge 暴露 window.galleryMedia。 |
| examples/gallery/plugins/assets/src/* | 原生格式处理、素材加载、JustifiedInfiniteGrid、右侧预览。 |
| examples/gallery/plugins/format-jxl/src/* | JXL decoder Worker 与 FormatExtension 静态注册。 |
| examples/gallery/cordis.yml | 固定的 formats → assets → jxl 启动顺序。 |

### Task 1: 提供最小格式宿主与跨进程契约

**Files:**
- Create: packages/gallery/formats/package.json
- Create: packages/gallery/formats/tsconfig.json
- Create: packages/gallery/formats/src/index.ts
- Create: packages/gallery/formats/src/index.test.ts
- Modify: examples/gallery/package.json
- Modify: examples/gallery/cordis.yml

**Interfaces:**
- Produces AssetRecord、Thumbnail、FormatExtension、GalleryMediaApi 和 Cordis ctx.formats。
- Consumes no Gallery renderer code; later tasks receive the static FormatRegistry service.

- [ ] **Step 1: Write the failing test**

```ts
it('returns the registered extension for an asset suffix', async () => {
  const ctx = new Context();
  const fiber = ctx.plugin(formats);
  await fiber.await();
  const dispose = ctx.formats.register({
    id: 'fixture', version: '1', extensions: ['.fixture'],
    createThumbnail: vi.fn(), Viewer: () => null,
  });
  expect(ctx.formats.find('.fixture')?.id).toBe('fixture');
  dispose();
  expect(ctx.formats.find('.fixture')).toBeUndefined();
  await fiber.dispose();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: CI=true pnpm vitest run packages/gallery/formats/src/index.test.ts

Expected: FAIL because the package and ctx.formats do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface AssetRecord {
  id: string; name: string; extension: string; size: number; modifiedAt: number;
}
export interface Thumbnail {
  bytes: Uint8Array; mimeType: 'image/png' | 'image/webp';
}
export interface FormatExtension {
  id: string; version: string; extensions: readonly string[];
  createThumbnail(source: Uint8Array): Promise<Thumbnail>;
  Viewer: ComponentType<{ source: Uint8Array; name: string }>;
}
export class FormatRegistry extends Service {
  register(extension: FormatExtension): () => void;
  find(extension: string): FormatExtension | undefined;
}
```

apply() creates FormatRegistry with ctx.reflect.provide('formats', registry). register() normalizes suffixes to lower case and throws when another extension already owns that suffix. Add @yunzhen/gallery-formats to Gallery dependencies and add the formats entry before assets in cordis.yml.

- [ ] **Step 4: Run test to verify it passes**

Run: CI=true pnpm vitest run packages/gallery/formats/src/index.test.ts && CI=true pnpm --filter @yunzhen/gallery-formats exec tsc --noEmit

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/gallery/formats examples/gallery/package.json examples/gallery/cordis.yml pnpm-lock.yaml
git commit -m "feat(gallery): add format registry"
```

### Task 2: 主进程限定本地目录、素材读取和缓存

**Files:**
- Create: examples/gallery/src/main/media-library.ts
- Create: examples/gallery/src/main/media-library.test.ts
- Modify: examples/gallery/src/main/index.ts
- Modify: examples/gallery/src/preload/index.ts
- Modify: examples/gallery/src/renderer/src/vite-env.d.ts

**Interfaces:**
- Consumes AssetRecord、Thumbnail 和 GalleryMediaApi。
- Produces window.galleryMedia.chooseRoot/listAssets/readAsset/readThumbnail/writeThumbnail; all methods accept AssetRecord.id rather than a file path.

- [ ] **Step 1: Write the failing test**

```ts
it('scans supported files recursively but skips symlinks', async () => {
  await writeFile(join(root, 'a.png'), 'png');
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested', 'b.jxl'), 'jxl');
  await symlink(join(root, 'a.png'), join(root, 'linked.webp'));
  const library = await MediaLibrary.create({ cacheRoot, configPath, root });
  expect((await library.listAssets()).map(asset => asset.name)).toEqual(['b.jxl', 'a.png']);
});
it('rejects a read for an id not returned by the current scan', async () => {
  await expect(library.readAsset('outside-root')).rejects.toThrow('unknown asset');
});
it('misses cache after a processor-version change', async () => {
  await library.writeThumbnail(asset.id, 'native@1', thumbnail);
  expect(await library.readThumbnail(asset.id, 'native@2')).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: CI=true pnpm vitest run examples/gallery/src/main/media-library.test.ts

Expected: FAIL because MediaLibrary does not exist.

- [ ] **Step 3: Write minimal implementation**

MediaLibrary uses lstat, readdir({ withFileTypes: true }) and readFile. It walks real directories only, filters the five lower-case extensions, and returns descending modifiedAt order. Its id is sha256(relativePath) hex. Every listAssets() refreshes the id-to-path map; readAsset(id) rejects unknown ids.

```ts
async readAsset(id: string): Promise<Uint8Array>;
async readThumbnail(id: string, processor: string): Promise<Thumbnail | undefined>;
async writeThumbnail(id: string, processor: string, thumbnail: Thumbnail): Promise<void>;
async setRoot(root: string): Promise<readonly AssetRecord[]>;
```

Cache key is sha256 of path, size, mtimeMs, extension and processor joined with a null delimiter, stored as JSON { mimeType, bytesBase64 } in userData/gallery/thumbnails. Reject writes not marked image/png or image/webp and writes over 10 MiB. index.ts invokes dialog.showOpenDialog({ properties: ['openDirectory'] }) and forwards only its chosen result to setRoot; IPC handlers invoke MediaLibrary for every other operation. preload exposes only the fixed GalleryMediaApi with contextBridge.

- [ ] **Step 4: Run test to verify it passes**

Run: CI=true pnpm vitest run examples/gallery/src/main/media-library.test.ts && CI=true pnpm --filter @examples/gallery exec tsc --noEmit

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/gallery/src/main examples/gallery/src/preload examples/gallery/src/renderer/src/vite-env.d.ts
git commit -m "feat(gallery): add local media IPC"
```

### Task 3: 用原生格式替换远程示例网格并接入 workbench

**Files:**
- Create: examples/gallery/plugins/assets/src/native-format.tsx
- Create: examples/gallery/plugins/assets/src/media.ts
- Modify: examples/gallery/plugins/assets/src/index.tsx
- Modify: examples/gallery/plugins/assets/src/home-page.tsx
- Modify: examples/gallery/plugins/assets/src/home-page.module.css
- Modify: examples/gallery/plugins/assets/src/index.test.tsx
- Modify: examples/gallery/plugins/assets/package.json

**Interfaces:**
- Consumes ctx.formats and window.galleryMedia.
- Produces the native FormatExtension for png/jpg/jpeg/webp and route-owned assets.workbench.

- [ ] **Step 1: Write the failing test**

```tsx
it('opens the chosen asset in the route-owned workbench', async () => {
  vi.stubGlobal('galleryMedia', fixtureMediaApi([
    { id: 'bird', name: 'bird.png', extension: '.png', size: 1, modifiedAt: 1 },
  ]));
  const { container, dispose } = await mountGallery([formats, assets]);
  await act(async () => container.querySelector<HTMLButtonElement>('[data-choose-root]')?.click());
  await act(async () => container.querySelector<HTMLElement>('[data-asset-id="bird"]')?.dblclick());
  expect(container.querySelector('[data-workbench-column] img')?.getAttribute('alt')).toBe('bird.png');
  await dispose();
});
```

Add cases that: no root shows data-choose-root; .txt never enters the grid; a failed read leaves a named card with 预览失败 while another card remains visible.

- [ ] **Step 2: Run test to verify it fails**

Run: CI=true pnpm vitest run examples/gallery/plugins/assets/src/index.test.tsx

Expected: FAIL because the page still renders remote official-grid mocks.

- [ ] **Step 3: Write minimal implementation**

native-format.tsx turns source bytes into a Blob/Object URL. Its createThumbnail uses an image element plus canvas, constrains the longest edge to 400px, and obtains image/webp at quality 0.82. Viewer renders the same Object URL and revokes it in effect cleanup.

media.ts lists AssetRecord items, checks cache with the handler id and version, and on a miss reads the id bytes, calls ctx.formats.find(asset.extension), and writes the result. Rejected reads or decodes become state error instead of throwing from HomePage.

apply() first registers the native extension, declares assets.workbench on the home route, and uses nested ctx.slots.inject() calls to contribute that route child to the global workbench slot. HomePage keeps JustifiedInfiniteGrid but deletes getItems() and the naver URL; cards have data-asset-id, click to select, and double-click to open workbench. Page unmount calls ctx.layout.closeWorkbench().

- [ ] **Step 4: Run test to verify it passes**

Run: CI=true pnpm vitest run examples/gallery/plugins/assets/src/index.test.tsx && pnpm eslint examples/gallery/plugins/assets/src && CI=true pnpm build:gallery

Expected: PASS and the Gallery bundle contains no naver.github.io/egjs-infinitegrid/assets/image URL.

- [ ] **Step 5: Commit**

```bash
git add examples/gallery/plugins/assets examples/gallery/package.json pnpm-lock.yaml
git commit -m "feat(gallery): browse native local assets"
```

### Task 4: 添加静态 JXL 格式扩展

**Files:**
- Create: examples/gallery/plugins/format-jxl/package.json
- Create: examples/gallery/plugins/format-jxl/tsconfig.json
- Create: examples/gallery/plugins/format-jxl/src/index.tsx
- Create: examples/gallery/plugins/format-jxl/src/decode-worker.ts
- Create: examples/gallery/plugins/format-jxl/src/index.test.tsx
- Modify: examples/gallery/package.json
- Modify: examples/gallery/cordis.yml
- Modify: pnpm-lock.yaml

**Interfaces:**
- Consumes ctx.formats and @jsquash/jxl/decode.
- Produces the registered extension { id: 'jxl', version: '1.0.0', extensions: ['.jxl'] }.

- [ ] **Step 1: Write the failing test**

```ts
it('registers JXL without changing native format ownership', async () => {
  const ctx = await createFormatContext();
  const fiber = ctx.plugin(jxl);
  await fiber.await();
  expect(ctx.formats.find('.jxl')?.id).toBe('jxl');
  expect(ctx.formats.find('.png')).toBeUndefined();
  await fiber.dispose();
});
it('turns a decoder rejection into a thumbnail failure', async () => {
  vi.mocked(decodeJxl).mockRejectedValueOnce(new Error('invalid JXL'));
  await expect(createJxlThumbnail(new Uint8Array([0]))).rejects.toThrow('invalid JXL');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: CI=true pnpm vitest run examples/gallery/plugins/format-jxl/src/index.test.tsx

Expected: FAIL because the JXL static extension is absent.

- [ ] **Step 3: Write minimal implementation**

Run: pnpm add @jsquash/jxl@1.3.0 --filter @examples/gallery-format-jxl

decode-worker.ts imports decode from @jsquash/jxl/decode, receives { id, bytes }, transfers bytes.buffer, and posts { id, width, height, pixels } or { id, error }. index.tsx creates one Worker per decode and sets a 30-second timer; completion, worker error, and timeout all terminate the Worker. It draws ImageData to Canvas and returns a 400px-bounded WebP Thumbnail. Viewer displays the derived Object URL.

The plugin exports inject = ['formats']; apply(ctx) only calls ctx.formats.register(jxlExtension). Add it last in cordis.yml and add the workspace dependency to examples/gallery/package.json. It does not import Eagle manifest.json, jxl2canvas.js, or Eagle binary files.

- [ ] **Step 4: Run test to verify it passes**

Run: CI=true pnpm vitest run examples/gallery/plugins/format-jxl/src/index.test.tsx && CI=true pnpm --filter @examples/gallery exec tsc --noEmit && CI=true pnpm build:gallery

Expected: PASS; cordis.boot.json contains formats, assets and jxl entries, and Vite emits JXL WASM as a build resource.

- [ ] **Step 5: Commit**

```bash
git add examples/gallery/plugins/format-jxl examples/gallery/package.json examples/gallery/cordis.yml pnpm-lock.yaml
git commit -m "feat(gallery): add JXL format extension"
```

### Task 5: 集成验证与范围回归

**Files:**
- Modify: docs/architecture.md
- Modify: docs/superpowers/specs/2026-09-02-gallery-format-extension-host-design.md

**Interfaces:**
- Consumes all preceding tasks.
- Produces the documented distinction between static built-in format extensions and future dynamic third-party installation.

- [ ] **Step 1: Add architecture boundary**

In docs/architecture.md document: the main process owns local-directory authorization; renderer requests bytes only by asset id; format extensions ship in the static Cordis boot graph; dynamic third-party installation requires a separate signing, permissions, isolation and runtime-loading design.

- [ ] **Step 2: Run final automated verification**

Run: CI=true pnpm vitest run packages/gallery/formats/src/index.test.ts examples/gallery/src/main/media-library.test.ts examples/gallery/plugins/assets/src/index.test.tsx examples/gallery/plugins/format-jxl/src/index.test.tsx && CI=true pnpm typecheck && pnpm lint && CI=true pnpm build:gallery && git diff --check

Expected: every command exits 0. If pnpm peers check still reports the existing electron-vite/Vite 8 constraint, record it without lowering Vite or disabling peer validation.

- [ ] **Step 3: Run manual directory acceptance**

Run: pnpm start:gallery

Choose a directory with PNG, JPEG, WebP and JXL. Verify: empty state exposes the chooser; grid shows only the four extensions; double-click opens workbench; malformed JXL displays a failure card while other assets work; edit an image then refresh and see a new thumbnail.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/superpowers/specs/2026-09-02-gallery-format-extension-host-design.md
git commit -m "docs(gallery): document format extension boundary"
```

