# Eagle Electron Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent Electron example that boots the existing Cordis base runtime without any gallery business feature or native API.

**Architecture:** `examples/eagle` owns Electron main, preload, and renderer entries, built by electron-vite. Its renderer reuses the existing Cordis Vite boot-graph generator with a distinct virtual-module id and a graph containing only i18n, renderer, router, layout, and theme.

**Tech Stack:** Electron, electron-vite, Vite, React 19, TypeScript, Cordis 4, pnpm workspace, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-eagle-electron-initialization-design.md`

## Global Constraints

- Create `examples/eagle`; do not modify the existing agent feature plugins or add any gallery feature.
- Depend only on Electron, electron-vite, Node types, and existing Cordis workspace packages; do not add persistence, image processing, virtual-list, or installer dependencies.
- The Electron renderer must keep `nodeIntegration: false` and `contextIsolation: true`; the preload exposes no API and the main process registers no IPC handler.
- The Cordis graph must contain exactly `i18n`, `renderer`, `router`, `layout`, and `theme`, in that resolved dependency order.
- Preserve unrelated untracked files in `docs/superpowers/plans/`.

---

### Task 1: Generalize the existing Cordis Vite boot virtual module

**Files:**
- Modify: `examples/agent/vite-plugin.ts`
- Modify: `examples/agent/vite-plugin.test.ts`

**Interfaces:**
- Consumes: a Cordis YAML graph path and a Vite virtual module id.
- Produces: `cordisWebBoot(options?: { configPath?: string; virtualModuleId?: string }): Plugin`, resolving the supplied id to its NUL-prefixed module and exporting its generated graph and plugin registry.

- [ ] **Step 1: Add a regression test for a custom virtual id**

```ts
it('resolves a supplied virtual module id', () => {
  const plugin = cordisWebBoot({ virtualModuleId: 'virtual:cordis-eagle-boot' });

  expect(plugin.resolveId?.('virtual:cordis-eagle-boot')).toBe('\0virtual:cordis-eagle-boot');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/agent/vite-plugin.test.ts`

Expected: FAIL because `cordisWebBoot` does not accept an options object and still resolves only `virtual:cordis-example-agent-boot`.

- [ ] **Step 3: Make the boot plugin configurable without changing its default agent behavior**

```ts
interface CordisWebBootOptions {
  configPath?: string
  virtualModuleId?: string
}

export function cordisWebBoot({
  configPath = resolve(import.meta.dirname, 'cordis.yml'),
  virtualModuleId = 'virtual:cordis-example-agent-boot',
}: CordisWebBootOptions = {}): Plugin {
  const resolvedVirtualModuleId = `\0${virtualModuleId}`
  // keep the existing cached graph, buildStart, generateBundle, load, and resolveId hooks
}
```

Use the local `virtualModuleId` and `resolvedVirtualModuleId` in `load` and `resolveId`; keep `renderWebBootVirtualModule()` and `emitWebBootGraph()` unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `CI=true pnpm exec vitest run examples/agent/vite-plugin.test.ts`

Expected: PASS, including the existing generated-module and `cordis.boot.json` assertions.

- [ ] **Step 5: Commit the reusable boot-plugin change**

```bash
git add examples/agent/vite-plugin.ts examples/agent/vite-plugin.test.ts
git commit -m "refactor: configure cordis web boot module"
```

### Task 2: Add the Electron example manifest and Cordis graph

**Files:**
- Create: `examples/eagle/package.json`
- Create: `examples/eagle/tsconfig.json`
- Create: `examples/eagle/cordis.yml`
- Create: `examples/eagle/vite-plugin.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `cordisWebBoot({ configPath, virtualModuleId })` from `examples/agent/vite-plugin.ts` and the five Cordis workspace client packages.
- Produces: workspace package `@examples/eagle` with `dev`, `build`, and `start` scripts, plus an exact base Cordis graph.

- [ ] **Step 1: Add a test that locks the base graph to the five requested entries**

```ts
import { loadWebBootGraph } from '@yunzhen/cordis-host-plugin-catalog'
import { expect, it } from 'vitest'

it('contains only the base Cordis runtime', () => {
  const graph = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname)

  expect(graph.entries.map(entry => entry.id)).toEqual(['i18n', 'renderer', 'router', 'layout', 'theme'])
})
```

- [ ] **Step 2: Run the new graph test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/eagle/vite-plugin.test.ts`

Expected: FAIL because the Eagle graph and test source do not exist.

- [ ] **Step 3: Create the manifest, TypeScript project, and declarative base graph**

Create `examples/eagle/package.json` with `name: "@examples/eagle"`, `type: "module"`, `main: "./out/main/index.js"`, and scripts:

```json
{
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "start": "electron-vite preview"
}
```

Add these runtime workspace dependencies: `@yunzhen/cordis-client-modules`, `@yunzhen/cordis-host-plugin-catalog`, `@yunzhen/cordis-ui-i18n`, `@yunzhen/cordis-ui-renderer`, `@yunzhen/cordis-ui-router`, `@yunzhen/cordis-ui-layout`, and `@yunzhen/cordis-ui-theme`. Add `electron`, `electron-vite`, and `@types/node` as development dependencies.

Create `examples/eagle/tsconfig.json` extending `@yunzhen/tsconfig/web.json` and including `src`. Create `cordis.yml` with exactly:

```yaml
- id: i18n
  name: '@yunzhen/cordis-ui-i18n'
- id: renderer
  name: '@yunzhen/cordis-ui-renderer'
- id: router
  name: '@yunzhen/cordis-ui-router'
- id: layout
  name: '@yunzhen/cordis-ui-layout'
- id: theme
  name: '@yunzhen/cordis-ui-theme'
```

Add non-destructive root shortcuts without changing the current agent defaults:

```json
{
  "build:eagle": "pnpm --filter @examples/eagle build",
  "dev:eagle": "pnpm --filter @examples/eagle dev"
}
```

- [ ] **Step 4: Resolve the dependency graph through pnpm**

Run: `pnpm install`

Expected: lockfile includes the new workspace importer, Electron, electron-vite, and only the declared additions; no peer-dependency override or trust-policy change is introduced.

- [ ] **Step 5: Run the graph test to verify it passes**

Run: `CI=true pnpm exec vitest run examples/eagle/vite-plugin.test.ts`

Expected: PASS with the exact five ordered entry ids.

- [ ] **Step 6: Commit the package and graph setup**

```bash
git add package.json pnpm-lock.yaml examples/eagle/package.json examples/eagle/tsconfig.json examples/eagle/cordis.yml examples/eagle/vite-plugin.test.ts
git commit -m "feat: add eagle cordis runtime"
```

### Task 3: Add the minimal Electron main, preload, and Cordis renderer entries

**Files:**
- Create: `examples/eagle/electron.vite.config.ts`
- Create: `examples/eagle/src/main/index.ts`
- Create: `examples/eagle/src/preload/index.ts`
- Create: `examples/eagle/src/renderer/index.html`
- Create: `examples/eagle/src/renderer/src/main.tsx`
- Create: `examples/eagle/src/renderer/src/vite-env.d.ts`

**Interfaces:**
- Consumes: Electron's development renderer URL, the built `out/preload/index.js`, and the Eagle virtual Cordis boot module.
- Produces: an Electron window that loads the development renderer when available or the built local renderer otherwise; a renderer that mounts the five-entry Cordis graph.

- [ ] **Step 1: Add the renderer virtual-module declaration before its entry exists**

```ts
declare module 'virtual:cordis-eagle-boot' {
  import type { PluginRegistry, WebBootGraph } from '@yunzhen/cordis-client-modules'

  export const graph: WebBootGraph
  export const registry: PluginRegistry
}
```

- [ ] **Step 2: Run the Eagle build to verify it fails**

Run: `pnpm --filter @examples/eagle build`

Expected: FAIL because the electron-vite configuration and the three process entries do not exist.

- [ ] **Step 3: Create the smallest secure Electron shell and renderer bootstrap**

Configure electron-vite with React in `renderer.plugins` and the reused boot plugin:

```ts
renderer: {
  plugins: [
    cordisWebBoot({
      configPath: resolve(import.meta.dirname, 'cordis.yml'),
      virtualModuleId: 'virtual:cordis-eagle-boot',
    }),
    react(),
  ],
}
```

In `src/main/index.ts`, create one `BrowserWindow` after `app.whenReady()`. Set:

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: join(mainDirectory, '../preload/index.js'),
}
```

Load `process.env.ELECTRON_RENDERER_URL` during development and `../renderer/index.html` relative to the built main file otherwise. Use `fileURLToPath(import.meta.url)` to obtain `mainDirectory`, keep the standard `window-all-closed` quit behavior for non-macOS, and create another window on macOS `activate` when none exist.

Make `src/preload/index.ts` contain only `export {}`. Do not expose `contextBridge` methods.

Create the renderer HTML with `<div id="root"></div>` and a module script to `./src/main.tsx`. In `main.tsx`, boot the generated graph exactly as the agent example does:

```ts
void bootWebApp({
  container: document.getElementById('root')!,
  graph,
  registry,
}).catch(error => console.error(error))
```

- [ ] **Step 4: Build both examples and run the repository type checks**

Run: `pnpm --filter @examples/agent build && pnpm --filter @examples/eagle build && CI=true pnpm typecheck`

Expected: both Vite builds succeed, Eagle emits `out/main`, `out/preload`, `out/renderer`, and TypeScript reports no errors.

- [ ] **Step 5: Manually verify the development shell**

Run: `pnpm --filter @examples/eagle dev`

Expected: Electron opens one local window with no DevTools error, no exposed preload API, and no IPC registration; stop it after inspection.

- [ ] **Step 6: Commit the complete shell**

```bash
git add examples/eagle/electron.vite.config.ts examples/eagle/src
git commit -m "feat: initialize eagle electron example"
```

### Task 4: Final regression and scope verification

**Files:**
- Modify: none unless a preceding verification reports an initialization defect.

**Interfaces:**
- Consumes: all three completed initialization deliverables.
- Produces: evidence that the example stays within the approved no-gallery, no-IPC boundary.

- [ ] **Step 1: Verify there is no premature native or gallery surface**

Run: `rg -n "ipc(Main|Renderer)|contextBridge|nodeIntegration:\s*true|fs/|better-sqlite|sharp|electron-builder" examples/eagle`

Expected: no matches.

- [ ] **Step 2: Run focused boot-graph and full test suites**

Run: `CI=true pnpm exec vitest run examples/agent/vite-plugin.test.ts examples/eagle/vite-plugin.test.ts && CI=true pnpm test`

Expected: all tests pass; both agent and Eagle boot-graph checks remain green.

- [ ] **Step 3: Check the final diff and worktree ownership boundaries**

Run: `git diff --check HEAD~3..HEAD && git status --short`

Expected: no whitespace errors; only scoped Eagle/setup commits are new and the pre-existing untracked plan files remain unmodified.

- [ ] **Step 4: Record final validation in the handoff**

Report the three commit ids, dependency versions selected by pnpm, build/test commands and outcomes, and the manual Electron-window validation boundary.
