# Gallery Desktop Format Plugin Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Gallery install a ZIP format plugin from the desktop, use it for isolated thumbnail generation and workbench preview, and prove the path with a PSD plugin.

**Architecture:** The Electron main process owns ZIP validation, persistent installation state and the `gallery-plugin://` resource protocol. The renderer registers installed format descriptors into the existing `FormatRegistry`; a host-owned sandbox iframe runs thumbnail workers and another sandbox iframe renders the plugin viewer. Third-party code only receives the bytes of one asset through `postMessage`.

**Tech Stack:** Electron 44, React 19, Cordis, TypeScript, Vite 8, Vitest, `yauzl@3.4.0`, `yazl@3.3.1`, `ag-psd@31.0.2`.

**Spec:** `docs/superpowers/specs/2026-09-02-gallery-desktop-format-plugin-installation-design.md`

## Global Constraints

- Accept only a user-selected ZIP; do not implement a development-directory loader, plugin store, remote update or Eagle-plugin compatibility.
- Store each installed plugin below `app.getPath('userData')/gallery/plugins/<plugin-id>` and installation state in Gallery user data.
- Never expose Node, Electron, preload APIs, Gallery DOM, real plugin paths or arbitrary IPC to installed plugin code.
- Reject archive path traversal, symbolic links, over-limit archives, invalid manifests, missing declared entries, duplicate ids and enabled extension conflicts before changing installed state.
- Limit thumbnail input/output size, declared pixel area and execution time; a plugin failure affects only that asset card.
- Keep JXL static and built in; PSD is the sole installed-plugin demonstration.

---

## File Structure

- `packages/gallery/formats/src/index.ts` — shared manifest, installed-plugin record and preload API DTOs; retains the static format contract.
- `examples/gallery/src/main/format-plugin-manager.ts` — validates, extracts, persists, enables and removes plugin packages; resolves only declared resources.
- `examples/gallery/src/main/plugin-protocol.ts` — registers and serves the restricted plugin URL scheme plus the host-owned thumbnail runner document.
- `examples/gallery/src/main/index.ts` — wires Gallery main-process services and narrow IPC handlers.
- `examples/gallery/src/preload/index.ts` — exposes the typed plugin-management methods, not raw IPC.
- `examples/gallery/plugins/assets/src/installed-formats.tsx` — turns installed descriptors into existing `FormatExtension` instances; owns sandboxed thumbnail and viewer lifecycles.
- `examples/gallery/plugins/assets/src/plugin-manager.tsx` — Gallery-facing install/enable/uninstall controls.
- `examples/gallery/plugins/assets/src/media.ts` — refreshes the already-listed assets after an installed-format mapping changes.
- `examples/gallery/plugins/assets/src/home-page.tsx` — opens the plugin-management controls and renders generic installed-plugin viewers in the workbench.
- `examples/gallery/plugins/format-psd/` — source and deterministic build/package script for the example installable PSD ZIP.

### Task 1: Define the installable format contract and securely manage ZIP packages

**Files:**
- Modify: `packages/gallery/formats/src/index.ts`
- Test: `packages/gallery/formats/src/index.test.ts`
- Create: `examples/gallery/src/main/format-plugin-manager.ts`
- Create: `examples/gallery/src/main/format-plugin-manager.test.ts`
- Modify: `examples/gallery/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `GalleryFormatPluginManifest`, `InstalledGalleryPlugin`, `GalleryPluginApi`, and `PluginFormatDescriptor` from `@yunzhen/gallery-formats`.
- Produces `FormatPluginManager.install(zipPath)`, `list()`, `setEnabled(id, enabled)`, `uninstall(id)`, and `resolveResource(pluginId, relativePath)` for the Electron process.
- Consumes existing `Thumbnail` and `FormatExtension` without changing static JXL/native registration.

- [ ] **Step 1: Add a failing manifest/manager test suite**

```ts
it('installs a valid plugin atomically and persists its enabled descriptor', async () => {
  const manager = await FormatPluginManager.create(fixturePaths());
  await createPluginZip(validManifest, { 'thumbnail/psd.worker.js': worker, 'viewer/psd.html': viewer });

  await expect(manager.install(zipPath)).resolves.toMatchObject({ id: 'com.example.psd', enabled: true });
  expect(await manager.list()).toEqual([expect.objectContaining({ id: 'com.example.psd', enabled: true })]);
  expect(await FormatPluginManager.create(fixturePaths()).then(manager => manager.list()))
    .resolves.toEqual([expect.objectContaining({ id: 'com.example.psd', enabled: true })]);
});

it.each(['../escape.js', '/absolute.js', 'thumbnail/missing.js'])('rejects unsafe or missing declared entries: %s', async (entry) => {
  await expect(manager.install(await zipWithManifest(entry))).rejects.toThrow();
  expect(await manager.list()).toEqual([]);
});

it('rejects a second enabled plugin that claims .psd and keeps the first plugin enabled', async () => {
  await manager.install(firstPsdZip);
  await expect(manager.install(secondPsdZip)).rejects.toThrow('format extension already enabled: .psd');
  expect(await manager.list()).toEqual([expect.objectContaining({ id: 'first.psd', enabled: true })]);
});
```

- [ ] **Step 2: Run the manager test to verify it fails**

Run: `pnpm exec vitest run examples/gallery/src/main/format-plugin-manager.test.ts`
Expected: FAIL because `format-plugin-manager.ts` and the install DTOs do not exist.

- [ ] **Step 3: Add the minimal shared DTOs and dependencies**

Add the following shared shapes beside the existing gallery types:

```ts
export interface PluginFormatDescriptor {
  extension: string;
  thumbnailWorker: string;
  viewer: string;
}

export interface GalleryFormatPluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  formats: Record<string, Omit<PluginFormatDescriptor, 'extension'>>;
}

export interface InstalledGalleryPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  formats: readonly PluginFormatDescriptor[];
}

export interface GalleryPluginApi {
  install: () => Promise<InstalledGalleryPlugin>;
  list: () => Promise<readonly InstalledGalleryPlugin[]>;
  setEnabled: (id: string, enabled: boolean) => Promise<readonly InstalledGalleryPlugin[]>;
  uninstall: (id: string) => Promise<readonly InstalledGalleryPlugin[]>;
}
```

Add runtime `yauzl@3.4.0` and `@types/yauzl@3.4.0` to `examples/gallery`; add root development dependencies `yazl@3.3.1` and `@types/yazl` for deterministic ZIP test fixtures and the PSD packaging script. Run `pnpm install` so the lockfile is the sole dependency-resolution record.

- [ ] **Step 4: Implement `FormatPluginManager` with bounded extraction**

Use `yauzl.openPromise(zipPath, { lazyEntries: true, validateEntrySizes: true })`; reject non-ZIP input, more than 200 entries, more than 100 MiB declared uncompressed bytes, unsafe names from `yauzl.validateFileName()`, duplicate archive paths, symbolic-link Unix mode bits, and entries outside a temporary directory. Stream each accepted file into `mkdtemp(join(pluginsRoot, '.install-'))`; never buffer an archive in memory.

After extracting, parse only root `manifest.json`; require the exact `schemaVersion: 1`, a slash-free previously uninstalled `id`, non-empty name/version, lowercase dot-prefixed extension keys and entry paths that resolve inside the temporary directory. Confirm every worker and viewer exists as a regular file. Compare all enabled descriptors before moving the temporary directory with `rename()`, write `plugins.json` only after the move succeeds, and clean the temporary directory in `finally` on every failure.

Implement `setEnabled()` by rejecting an extension collision before updating state. Implement `uninstall()` by removing the record first from the in-memory list, deleting the directory with the resolved explicit plugin path, then persisting the remaining list; if file deletion fails, restore the prior in-memory record and surface the error. `resolveResource()` must return a path only for an enabled plugin and a declared viewer/worker or a descendant under `assets/`.

- [ ] **Step 5: Run manager and shared-contract tests**

Run: `pnpm exec vitest run packages/gallery/formats/src/index.test.ts examples/gallery/src/main/format-plugin-manager.test.ts`
Expected: PASS; valid packages survive recreation, bad packages do not change state, and extension collisions are rejected.

- [ ] **Step 6: Commit the package-manager foundation**

```bash
git add package.json pnpm-lock.yaml examples/gallery/package.json \
  packages/gallery/formats/src/index.ts packages/gallery/formats/src/index.test.ts \
  examples/gallery/src/main/format-plugin-manager.ts examples/gallery/src/main/format-plugin-manager.test.ts
git commit -m "feat(gallery): manage format plugin packages"
```

### Task 2: Expose installed plugin resources through a restricted Electron boundary

**Files:**
- Create: `examples/gallery/src/main/plugin-protocol.ts`
- Create: `examples/gallery/src/main/plugin-protocol.test.ts`
- Modify: `examples/gallery/src/main/index.ts`
- Modify: `examples/gallery/src/preload/index.ts`
- Modify: `examples/gallery/src/renderer/src/vite-env.d.ts`

**Interfaces:**
- Consumes `FormatPluginManager` and `GalleryPluginApi` from Task 1.
- Produces `galleryPlugin` in the main world and `gallery-plugin://<plugin-id>/<path>` for declared resources only.
- Produces the host URL `gallery-plugin://<plugin-id>/__host/thumbnail-runner.html` without copying host code into a plugin package.

- [ ] **Step 1: Write failing protocol and preload tests**

```ts
it('serves only a declared plugin resource with a restrictive CSP', async () => {
  const response = await protocolHandler(new Request('gallery-plugin://com.example.psd/viewer/psd.html'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'none'");
  await expect(protocolHandler(new Request('gallery-plugin://com.example.psd/manifest.json'))).resolves.toMatchObject({ status: 404 });
});

it('exposes plugin installation methods but no raw ipcRenderer or file paths', () => {
  expect(Object.keys(exposedGalleryPlugin)).toEqual(['install', 'list', 'setEnabled', 'uninstall']);
});
```

- [ ] **Step 2: Run the protocol test to verify it fails**

Run: `pnpm exec vitest run examples/gallery/src/main/plugin-protocol.test.ts`
Expected: FAIL because the protocol handler and preload API do not exist.

- [ ] **Step 3: Implement the protocol before app readiness and wire narrow IPC**

Call `protocol.registerSchemesAsPrivileged([{ scheme: 'gallery-plugin', privileges: { secure: true, standard: true, supportFetchAPI: true } }])` at module evaluation time in `src/main/index.ts`. After constructing `FormatPluginManager`, register `protocol.handle('gallery-plugin', request => handlePluginRequest(request, manager))` and four explicit IPC channels: install, list, set-enabled and uninstall.

`handlePluginRequest()` parses the plugin id from the hostname, delegates authorization to `resolveResource()`, and returns 404 for anything else. Attach this CSP to every served plugin response:

```text
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self'; connect-src 'none'; frame-ancestors 'self'
```

Reserve `__host/thumbnail-runner.html` for a literal host-owned document. It receives a `MessagePort`, then uses `new Worker(workerUrl, { type: 'module' })`; it forwards `{ id, bytes, maxEdge }` and only forwards a response with `mimeType` `image/png` or `image/webp` and an `ArrayBuffer` no larger than 10 MiB. It terminates the worker after each reply or error.

Expose only the four methods through `contextBridge.exposeInMainWorld('galleryPlugin', galleryPlugin)`, and add the matching global declaration. Do not change the existing `galleryMedia` API.

- [ ] **Step 4: Run protocol and main-process tests**

Run: `pnpm exec vitest run examples/gallery/src/main/format-plugin-manager.test.ts examples/gallery/src/main/plugin-protocol.test.ts`
Expected: PASS; undeclared resources are inaccessible and the preload surface remains four methods.

- [ ] **Step 5: Commit the Electron boundary**

```bash
git add examples/gallery/src/main/index.ts examples/gallery/src/main/plugin-protocol.ts \
  examples/gallery/src/main/plugin-protocol.test.ts examples/gallery/src/preload/index.ts \
  examples/gallery/src/renderer/src/vite-env.d.ts
git commit -m "feat(gallery): isolate installed format plugins"
```

### Task 3: Register installed formats in the renderer without giving them host access

**Files:**
- Create: `examples/gallery/plugins/assets/src/installed-formats.tsx`
- Create: `examples/gallery/plugins/assets/src/installed-formats.test.tsx`
- Modify: `examples/gallery/plugins/assets/src/media.ts`
- Modify: `examples/gallery/plugins/assets/src/index.tsx`
- Modify: `examples/gallery/plugins/assets/src/home-page.tsx`
- Modify: `examples/gallery/plugins/assets/src/home-page.module.css`

**Interfaces:**
- Consumes `GalleryPluginApi`, `InstalledGalleryPlugin`, `PluginFormatDescriptor`, `FormatRegistry`, and the existing `MediaStore`.
- Produces `InstalledFormatController.refresh()` and `dispose()`; it registers one `FormatExtension` per enabled descriptor and owns all returned unregister callbacks.
- Produces generic `InstalledPluginViewer` and `createSandboxThumbnail()`; neither accepts a filesystem path.

- [ ] **Step 1: Write failing renderer tests**

```tsx
it('registers enabled .psd descriptors, produces one thumbnail request, and unregisters them on disable', async () => {
  const controller = new InstalledFormatController(ctx.formats, fixturePluginApi([psdPlugin]));
  await controller.refresh();
  expect(ctx.formats.find('.psd')?.id).toBe('com.example.psd');

  await expect(ctx.formats.find('.psd')!.createThumbnail(new Uint8Array([1]))).resolves.toMatchObject({ mimeType: 'image/webp' });
  await controller.setEnabled('com.example.psd', false);
  expect(ctx.formats.find('.psd')).toBeUndefined();
});

it('embeds an installed viewer in a sandboxed iframe and transfers only the source bytes', async () => {
  render(<InstalledPluginViewer descriptor={psdDescriptor} name="design.psd" source={new Uint8Array([1])} />);
  const frame = screen.getByTitle('design.psd preview');
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame.getAttribute('src')).toBe('gallery-plugin://com.example.psd/viewer/psd.html');
});
```

- [ ] **Step 2: Run renderer tests to verify they fail**

Run: `pnpm exec vitest run examples/gallery/plugins/assets/src/installed-formats.test.tsx`
Expected: FAIL because no installed-format controller or generic viewer exists.

- [ ] **Step 3: Implement the controller, thumbnail sandbox and generic viewer**

`InstalledFormatController.refresh()` calls `galleryPlugin.list()`, removes registrations absent from the new enabled descriptor set, then registers proxies through the existing `ctx.formats.register()`. The proxy id is `<plugin.id>:<extension>` and version is `<plugin.version>` so current thumbnail-cache invalidation continues to work.

`createSandboxThumbnail()` creates an off-screen iframe with `sandbox="allow-scripts"` and source `gallery-plugin://<plugin.id>/__host/thumbnail-runner.html`. On `load`, create a `MessageChannel`, post a copied source buffer, `id` and `maxEdge: 400` through port 2, and accept one validated result from port 1. Time out after 30 seconds, remove the iframe and close both ports on every terminal path.

`InstalledPluginViewer` creates `<iframe sandbox="allow-scripts" title={`${name} preview`}>`; after it loads, copy and send `{ type: 'gallery-plugin:asset', name, bytes }` by `postMessage`. Revoke no plugin URL because this viewer uses the protocol URL, and remove the iframe event listener when React unmounts.

Change `MediaStore.load()` to public `reload()` so the controller can re-filter the current asset list after installation, enablement, disablement or uninstall. Keep the four-item thumbnail concurrency limit. In `AssetsWorkbench`, continue rendering `opened.format.Viewer`; the installed proxy supplies `InstalledPluginViewer`, while native and JXL continue supplying their current components.

- [ ] **Step 4: Run installed-format and existing Gallery UI tests**

Run: `pnpm exec vitest run examples/gallery/plugins/assets/src/installed-formats.test.tsx examples/gallery/plugins/assets/src/index.test.tsx examples/gallery/plugins/format-jxl/src/index.test.tsx`
Expected: PASS; installed formats are dynamic while native/JXL behavior and workbench ownership remain unchanged.

- [ ] **Step 5: Commit renderer format activation**

```bash
git add examples/gallery/plugins/assets/src/installed-formats.tsx \
  examples/gallery/plugins/assets/src/installed-formats.test.tsx \
  examples/gallery/plugins/assets/src/media.ts examples/gallery/plugins/assets/src/index.tsx \
  examples/gallery/plugins/assets/src/home-page.tsx examples/gallery/plugins/assets/src/home-page.module.css
git commit -m "feat(gallery): activate installed format plugins"
```

### Task 4: Add the smallest desktop plugin-management UI

**Files:**
- Create: `examples/gallery/plugins/assets/src/plugin-manager.tsx`
- Create: `examples/gallery/plugins/assets/src/plugin-manager.test.tsx`
- Modify: `examples/gallery/plugins/assets/src/home-page.tsx`
- Modify: `examples/gallery/plugins/assets/src/home-page.module.css`
- Modify: `examples/gallery/plugins/assets/src/index.tsx`

**Interfaces:**
- Consumes `GalleryPluginApi` and `InstalledFormatController` from Task 3.
- Produces `FormatPluginManagerButton`, which refreshes formats and calls `MediaStore.reload()` only after a successful mutation.

- [ ] **Step 1: Write a failing interaction test**

```tsx
it('installs a plugin and refreshes the displayed asset list', async () => {
  const pluginApi = fixturePluginApi([]);
  pluginApi.install = vi.fn(async () => psdPlugin);
  render(<FormatPluginManagerButton plugins={controller} media={media} />);

  await user.click(screen.getByRole('button', { name: '安装格式插件' }));

  expect(pluginApi.install).toHaveBeenCalledOnce();
  expect(controller.refresh).toHaveBeenCalledOnce();
  expect(media.reload).toHaveBeenCalledOnce();
});

it('disables and uninstalls only the selected plugin', async () => {
  render(<FormatPluginManagerButton plugins={controller} media={media} />);
  await user.click(screen.getByRole('button', { name: '停用 PSD Format' }));
  expect(pluginApi.setEnabled).toHaveBeenCalledWith('com.example.psd', false);
  await user.click(screen.getByRole('button', { name: '卸载 PSD Format' }));
  expect(pluginApi.uninstall).toHaveBeenCalledWith('com.example.psd');
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `pnpm exec vitest run examples/gallery/plugins/assets/src/plugin-manager.test.tsx`
Expected: FAIL because the management controls do not exist.

- [ ] **Step 3: Implement one compact control surface**

Place an `安装格式插件` button beside `选择素材文件夹`. Render a small in-page plugin list below the controls only when it contains an installed plugin: plugin name/version, enabled state, a `停用` or `启用` button, and `卸载`. Await every action; while one action is pending, disable only the relevant control and render its caught error text beside the list. Do not add settings routes, modal infrastructure or a second workbench.

After a successful install, enablement change or uninstall, call `await controller.refresh()` and then `await media.reload()`. If either API call rejects, preserve the current list and show its error message; do not optimistically alter enabled state.

- [ ] **Step 4: Run all Gallery renderer tests**

Run: `pnpm exec vitest run examples/gallery/plugins/assets/src/plugin-manager.test.tsx examples/gallery/plugins/assets/src/installed-formats.test.tsx examples/gallery/plugins/assets/src/index.test.tsx`
Expected: PASS; the UI calls the narrow API and refreshes only after successful mutations.

- [ ] **Step 5: Commit plugin management UI**

```bash
git add examples/gallery/plugins/assets/src/plugin-manager.tsx \
  examples/gallery/plugins/assets/src/plugin-manager.test.tsx \
  examples/gallery/plugins/assets/src/home-page.tsx examples/gallery/plugins/assets/src/home-page.module.css \
  examples/gallery/plugins/assets/src/index.tsx
git commit -m "feat(gallery): manage installed format plugins"
```

### Task 5: Build an installable PSD format plugin

**Files:**
- Create: `examples/gallery/plugins/format-psd/package.json`
- Create: `examples/gallery/plugins/format-psd/manifest.json`
- Create: `examples/gallery/plugins/format-psd/vite.config.ts`
- Create: `examples/gallery/plugins/format-psd/src/thumbnail.worker.ts`
- Create: `examples/gallery/plugins/format-psd/src/viewer.html`
- Create: `examples/gallery/plugins/format-psd/src/viewer.ts`
- Create: `examples/gallery/plugins/format-psd/scripts/package.mjs`
- Create: `examples/gallery/plugins/format-psd/src/thumbnail.worker.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `examples/gallery/plugins/format-psd/dist/psd.gallery-plugin.zip` containing the Task 1 manifest and declared worker/viewer entries.
- Consumes worker input `{ id, bytes, maxEdge }` and returns `{ id, bytes, mimeType }` from Task 2.

- [ ] **Step 1: Write a failing PSD worker test**

```ts
it('turns a safe PSD composite into a bounded WebP response', async () => {
  const response = await decodePsdThumbnail({ id: 'fixture', bytes: fixturePsd, maxEdge: 400 });
  expect(response).toMatchObject({ id: 'fixture', mimeType: 'image/webp' });
  expect(response.bytes.byteLength).toBeGreaterThan(0);
});

it('rejects a PSD whose declared pixel area exceeds 100 megapixels before canvas allocation', async () => {
  await expect(decodePsdThumbnail({ id: 'large', bytes: largeHeaderPsd, maxEdge: 400 }))
    .rejects.toThrow('PSD dimensions exceed 100 megapixels');
});
```

- [ ] **Step 2: Run the PSD worker test to verify it fails**

Run: `pnpm exec vitest run examples/gallery/plugins/format-psd/src/thumbnail.worker.test.ts`
Expected: FAIL because the installable PSD package and decoder do not exist.

- [ ] **Step 3: Implement the PSD worker, viewer and deterministic package script**

Add `ag-psd@31.0.2` to this workspace package. `thumbnail.worker.ts` imports `readPsd`, reads structure/raw composite metadata first, rejects width × height over 100,000,000 pixels, creates an `OffscreenCanvas` only after that check, scales to `maxEdge`, and calls `convertToBlob({ type: 'image/webp', quality: 0.82 })`.

The worker accepts only the host request shape and transfers the output `ArrayBuffer`; it does not call fetch, use paths or expose layer contents. `viewer.html` loads a bundled `viewer.ts`, receives `gallery-plugin:asset`, performs the same bounded decode locally, and writes only an `<img>` backed by a Blob URL. Revoke the prior Blob URL before drawing a new asset and when the page unloads.

Configure Vite to emit `thumbnail/psd.worker.js` and `viewer/psd.html` exactly as declared by `manifest.json`. `scripts/package.mjs` uses `yazl` to write `dist/psd.gallery-plugin.zip` from the three manifest resources and fails if an expected emitted file is absent. The package script is:

```json
{
  "scripts": {
    "build": "vite build && node scripts/package.mjs",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Build the PSD package and run its test**

Run: `pnpm --filter @examples/gallery-format-psd build && pnpm exec vitest run examples/gallery/plugins/format-psd/src/thumbnail.worker.test.ts`
Expected: PASS and `examples/gallery/plugins/format-psd/dist/psd.gallery-plugin.zip` contains `manifest.json`, `thumbnail/psd.worker.js`, and `viewer/psd.html`.

- [ ] **Step 5: Commit the PSD validation plugin**

```bash
git add examples/gallery/plugins/format-psd pnpm-lock.yaml
git commit -m "feat(gallery): add installable PSD format plugin"
```

### Task 6: Verify the complete desktop workflow and document the package contract

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-09-02-gallery-format-extension-host-design.md`
- Modify: `docs/superpowers/specs/2026-09-02-gallery-desktop-format-plugin-installation-design.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces the documented distinction: static Cordis boot plugins remain build-time; Gallery format packages are a separately sandboxed runtime subsystem.

- [ ] **Step 1: Update documentation**

Document the package schema, fixed ZIP-only installation boundary, maximum 200 archive entries/100 MiB uncompressed archive/10 MiB thumbnail/100 megapixel PSD/30-second thumbnail budget, and the absence of Eagle compatibility. Update the older static-host design so it points to this document for dynamic installation rather than claiming dynamic installation is solely a future concern. Update `docs/architecture.md` to state that runtime Gallery packages bypass neither the static Cordis boot graph nor Electron trust boundaries.

- [ ] **Step 2: Run the complete automated verification set**

Run:

```bash
pnpm exec vitest run packages/gallery/formats/src/index.test.ts \
  examples/gallery/src/main/media-library.test.ts \
  examples/gallery/src/main/format-plugin-manager.test.ts \
  examples/gallery/src/main/plugin-protocol.test.ts \
  examples/gallery/plugins/assets/src/index.test.tsx \
  examples/gallery/plugins/assets/src/installed-formats.test.tsx \
  examples/gallery/plugins/assets/src/plugin-manager.test.tsx \
  examples/gallery/plugins/format-jxl/src/index.test.tsx \
  examples/gallery/plugins/format-psd/src/thumbnail.worker.test.ts
CI=true pnpm --filter @examples/gallery build
CI=true pnpm --filter @examples/gallery exec tsc --noEmit
git diff --check
```

Expected: all targeted tests, Gallery build, Gallery type check and whitespace check pass. If root lint still reports the known unrelated `packages/ui/theme/src/styles.ts` violations, record it separately and do not modify it in this feature.

- [ ] **Step 3: Perform the manual Electron acceptance pass**

Run: `pnpm --dir examples/gallery dev`.

1. Choose a media directory containing a PSD file.
2. Click `安装格式插件` and choose `psd.gallery-plugin.zip`.
3. Confirm the PSD card receives a thumbnail and double-click opens the workbench preview.
4. Restart the app and confirm PSD still renders.
5. Disable PSD and confirm it disappears from the grid; enable it and confirm it returns.
6. Uninstall PSD and confirm the card becomes unsupported while original media files remain unchanged.
7. Attempt one malformed ZIP and confirm an error appears without altering the valid installed plugin.

- [ ] **Step 4: Commit the documentation and verification adjustments**

```bash
git add docs/architecture.md \
  docs/superpowers/specs/2026-09-02-gallery-format-extension-host-design.md \
  docs/superpowers/specs/2026-09-02-gallery-desktop-format-plugin-installation-design.md
git commit -m "docs(gallery): document installable format plugins"
```

## Plan Self-Review

- Spec coverage: ZIP-only install and persistence are Task 1; narrow Electron boundary is Task 2; isolated thumbnail/viewer execution is Task 3; user controls are Task 4; PSD proof package is Task 5; tests, manual acceptance and documentation are Task 6.
- Type consistency: Task 1 defines the DTOs used in Tasks 2–4; Task 2 fixes the Worker request/response protocol used by Task 3 and Task 5; `FormatExtension` remains the shared renderer integration point.
- Scope check: no task introduces plugin signing, remote delivery, Eagle compatibility, arbitrary desktop APIs or runtime Cordis boot-graph mutation.
