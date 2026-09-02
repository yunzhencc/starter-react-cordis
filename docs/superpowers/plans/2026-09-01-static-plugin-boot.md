# 静态插件启动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 由 cordis.yml 和包元数据生成 Web 启动图，在开发期和纯静态构建中按图加载并激活 Cordis 插件。

**Architecture:** Node-only catalog 读取 Loader 风格 YAML 和 yunzhen.client，产出确定性的 WebBootGraph。Vite 用它生成虚拟 ESM registry、构建期输出 cordis.boot.json；浏览器 Boot Loader 对每个 registry importer 执行 import() 并以 ctx.plugin() 激活，成功后挂载 UI。

**Tech Stack:** Node.js 22、TypeScript、yaml、Vite 8、React 19、Cordis 4、Vitest 4、pnpm。

**Spec:** docs/superpowers/specs/2026-09-01-deepseek-aligned-static-plugin-boot-design.md

## Global Constraints

- cordis.yml 是唯一启用来源，且为 Loader 条目的顶层 YAML 数组；支持 id、name、disabled 与 JSON config。
- 启用浏览器包必须导出 ./client，且声明 yunzhen.client.platform: "web"。
- yunzhen.client.inject 只能是包名，catalog 据此稳定拓扑排序。
- 生产只发布 dist；不做生产 Node 服务、组合 bundle、HMR、远程代码、运行时安装或动态运行器。
- 拒绝 !!js 和非 JSON config。
- Vite ESM chunk 覆盖本期加载；不引入 Harness 的 CJS factory facade、@deepseek-ai/cordis-plugin-loader 或 webAppPlugins 兼容层。

## File structure

| Path | Responsibility |
| --- | --- |
| cordis.yml | Ordered enabled Loader entries. |
| packages/host/plugin-catalog/src/index.ts | YAML/package-metadata parsing and graph creation. |
| packages/client/modules/src/manifest.ts | JSON-safe graph types and topology validation. |
| packages/client/modules/src/boot.ts | Browser registry activation, mount and failure UI. |
| apps/web/vite-plugin.ts | Virtual registry and static manifest emission. |
| apps/web/src/main.tsx | Catalog-backed application boot. |
| docs/architecture.md | Static deployment boundary. |

### Task 1: Add shared graph types and the Node catalog

**Files:**
- Create: packages/client/modules/src/manifest.ts
- Create: packages/client/modules/src/manifest.test.ts
- Modify: packages/client/modules/src/index.ts
- Modify: packages/client/modules/src/index.test.ts
- Create: packages/host/plugin-catalog/package.json
- Create: packages/host/plugin-catalog/src/index.ts
- Create: packages/host/plugin-catalog/src/index.test.ts
- Modify: pnpm-lock.yaml

**Interfaces:**
- Produces JsonValue, WebBootEntry, WebBootGraph, assertWebBootGraph(), sortWebBootEntries().
- Produces loadWebBootGraph(configPath: string): WebBootGraph.
- Entry shape: { id, name, inject, immediately, config? }.

- [ ] **Step 1: Write failing graph tests**

Create manifest.test.ts:

    import { expect, it } from 'vitest'
    import { sortWebBootEntries } from './manifest'

    it('sorts packages after their injected packages', () => {
      expect(sortWebBootEntries([
        { id: 'dashboard', name: '@app/dashboard', inject: ['@app/layout'], immediately: false },
        { id: 'renderer', name: '@app/renderer', inject: [], immediately: true },
        { id: 'layout', name: '@app/layout', inject: ['@app/renderer'], immediately: false },
      ]).map(entry => entry.id)).toEqual(['renderer', 'layout', 'dashboard'])
    })

    it('prints the dependency path for a cycle', () => {
      expect(() => sortWebBootEntries([
        { id: 'a', name: '@app/a', inject: ['@app/b'], immediately: false },
        { id: 'b', name: '@app/b', inject: ['@app/a'], immediately: false },
      ])).toThrow('@app/a -> @app/b -> @app/a')
    })

- [ ] **Step 2: Verify graph test fails**

Run: CI=true pnpm exec vitest run packages/client/modules/src/manifest.test.ts

Expected: FAIL because manifest.ts does not exist.

- [ ] **Step 3: Implement shared graph contract**

Create manifest.ts:

    export type JsonValue = null | boolean | number | string
      | readonly JsonValue[] | { readonly [key: string]: JsonValue }

    export interface WebBootEntry {
      id: string
      name: string
      inject: readonly string[]
      immediately: boolean
      config?: JsonValue
    }

    export interface WebBootGraph {
      revision: string
      entries: readonly WebBootEntry[]
    }

Implement DFS sorting keyed by entry.name. Preserve YAML order between sibling entries and reject duplicate id, duplicate package name, inactive dependency, cycle, empty id/name, non-boolean immediately, and non-JSON config. Use these error prefixes: web boot graph duplicate id, web boot graph duplicate package, web boot graph injects inactive package, web boot graph cycle. Re-export manifest.ts from index.ts and delete the URL-based PluginCatalogProvider contract and its old test.

- [ ] **Step 4: Write failing catalog tests**

Create temporary fixture packages under node_modules, each with a package.json. Test enabled ordering, disabled omission, absent ./client export, absent injected package, and !!js:

    it('omits disabled rows before topology validation', () => {
      expect(loadWebBootGraph(fixture.disabledDashboard).entries.map(row => row.id))
        .not.toContain('dashboard')
    })

    it.each([
      [fixture.withoutClientExport, /exports.\/client/],
      [fixture.withMissingDependency, /injects inactive package/],
      [fixture.withJavaScriptTag, /!!js/],
    ])('rejects invalid catalog input', (configPath, error) => {
      expect(() => loadWebBootGraph(configPath)).toThrow(error)
    })

- [ ] **Step 5: Verify catalog test fails**

Run: CI=true pnpm exec vitest run packages/host/plugin-catalog/src/index.test.ts

Expected: FAIL because the package does not exist.

- [ ] **Step 6: Implement catalog with no plugin execution**

Add @yunzhen/cordis-host-plugin-catalog with dependencies yaml and @yunzhen/cordis-client-modules. Parse with YAML.parseDocument(), reject YAML JavaScript tags before conversion, and resolve each configured package manifest with findPackageJSON(name, pathToFileURL(configPath)). Do not import a plugin.

Validate exports['./client'] as a string or a conditional export with string default. Validate this package subset:

    interface ClientMetadata {
      platform: 'web'
      inject?: string[]
      immediately?: boolean
    }

    interface PackageManifest {
      name: string
      exports?: Record<string, unknown>
      yunzhen?: { client?: ClientMetadata }
    }

Filter disabled rows, normalize inject to [] and immediately to false, sort entries, and compute revision as the first 12 SHA-256 hex characters of canonical JSON entries. Reject config unless JSON.stringify() and JSON.parse() succeed.

- [ ] **Step 7: Verify and commit catalog**

Run:

    CI=true pnpm exec vitest run packages/client/modules/src/manifest.test.ts packages/client/modules/src/index.test.ts packages/host/plugin-catalog/src/index.test.ts
    CI=true pnpm typecheck

Expected: PASS.

    git add packages/client/modules packages/host/plugin-catalog pnpm-lock.yaml
    git commit -m "feat: add web plugin catalog"

### Task 2: Add the browser ESM Boot Loader

**Files:**
- Create: packages/client/modules/src/boot.ts
- Create: packages/client/modules/src/boot.test.tsx
- Modify: packages/client/modules/src/index.ts
- Modify: packages/client/modules/package.json

**Interfaces:**
- Produces PluginModule, PluginRegistry, BootFailure, activateWebBootGraph(), bootWebApp(), renderBootFailure().
- PluginRegistry is ReadonlyMap<string, () => Promise<PluginModule>>.
- bootWebApp returns Promise<() => Promise<void>>.

- [ ] **Step 1: Write failing boot tests**

    // @vitest-environment jsdom
    import { Context } from '@deepseek-ai/cordis'
    import { expect, it } from 'vitest'
    import { activateWebBootGraph, type PluginRegistry } from './boot'

    it('imports and activates in graph order', async () => {
      const calls: string[] = []
      const registry: PluginRegistry = new Map([
        ['@app/renderer', async () => ({ apply: () => calls.push('renderer') })],
        ['@app/dashboard', async () => ({ apply: () => calls.push('dashboard') })],
      ])
      await activateWebBootGraph(new Context(), {
        revision: 'test',
        entries: [
          { id: 'renderer', name: '@app/renderer', inject: [], immediately: false },
          { id: 'dashboard', name: '@app/dashboard', inject: ['@app/renderer'], immediately: false },
        ],
      }, registry)
      expect(calls).toEqual(['renderer', 'dashboard'])
    })

    it('names the importing entry on bundle failure', async () => {
      await expect(activateWebBootGraph(new Context(), {
        revision: 'test',
        entries: [{ id: 'dashboard', name: '@app/dashboard', inject: [], immediately: false }],
      }, new Map([['@app/dashboard', async () => { throw new Error('offline') }]])))
        .rejects.toMatchObject({ entryId: 'dashboard', stage: 'import' })
    })

- [ ] **Step 2: Verify boot test fails**

Run: CI=true pnpm exec vitest run packages/client/modules/src/boot.test.tsx

Expected: FAIL because boot.ts does not exist.

- [ ] **Step 3: Implement ESM activation and failure UI**

    export type PluginModule = {
      inject?: readonly string[]
      apply: (ctx: Context, config?: unknown) => void
    }

    export type PluginRegistry = ReadonlyMap<string, () => Promise<PluginModule>>

    export class BootFailure extends Error {
      constructor(
        readonly entryId: string,
        readonly stage: 'registry' | 'import' | 'activate',
        cause: unknown,
      ) {
        super('web boot ' + stage + ' failed for ' + entryId + ': '
          + (cause instanceof Error ? cause.message : String(cause)), { cause })
      }
    }

activateWebBootGraph() validates the graph, obtains registry entry.name, awaits the importer, then awaits ctx.plugin(module, entry.config).await(). Missing registry, rejected import, and failed fiber launch throw BootFailure with YAML entry id and stage. It never mounts the UI.

bootWebApp() creates one Context, activates all entries, then calls ctx.uiRenderer.mount(container). On failure it disposes the root fiber and calls renderBootFailure(). renderBootFailure() replaces only the given root with a pre element having role="alert", containing BootFailure.message, without React.

- [ ] **Step 4: Add lifecycle checks**

Extend boot.test.tsx to prove a failed second plugin disposes the first and that renderBootFailure() exposes dashboard and import through getByRole('alert').

- [ ] **Step 5: Verify and commit boot loader**

Run:

    CI=true pnpm exec vitest run packages/client/modules/src/manifest.test.ts packages/client/modules/src/boot.test.tsx
    CI=true pnpm typecheck

Expected: PASS.

    git add packages/client/modules
    git commit -m "feat: add browser plugin boot loader"

### Task 3: Generate the Vite registry and migrate the app

**Files:**
- Create: cordis.yml
- Create: apps/web/vite-plugin.ts
- Create: apps/web/vite-plugin.test.ts
- Modify: apps/web/vite.config.ts
- Modify: apps/web/src/main.tsx
- Modify: apps/web/package.json
- Modify: packages/ui/renderer/package.json
- Modify: packages/ui/router/package.json
- Modify: packages/ui/layout/package.json
- Modify: packages/ui/theme/package.json
- Modify: packages/feature/dashboard/package.json
- Modify: packages/feature/settings/package.json
- Modify: tsconfig.json
- Delete: packages/bundle/web-app/package.json
- Delete: packages/bundle/web-app/src/index.ts
- Delete: packages/bundle/web-app/src/index.test.ts
- Modify: pnpm-lock.yaml

**Interfaces:**
- Provides virtual:cordis-web-boot exporting graph and registry.
- Emits dist/cordis.boot.json equal to graph.

- [ ] **Step 1: Write failing Vite-plugin tests**

    it('maps each catalog package to its client import', () => {
      const source = renderWebBootVirtualModule({
        revision: 'r1',
        entries: [{ id: 'renderer', name: '@app/renderer', inject: [], immediately: true }],
      })
      expect(source).toContain("import('@app/renderer/client')")
      expect(source).toContain("['@app/renderer', load0]")
    })

    it('emits the same graph as cordis.boot.json', () => {
      const output: Array<{ fileName: string; source: string }> = []
      emitWebBootGraph({ emitFile: file => output.push(file as never) }, graph)
      expect(JSON.parse(output[0]!.source)).toEqual(graph)
    })

- [ ] **Step 2: Verify Vite-plugin test fails**

Run: CI=true pnpm exec vitest run apps/web/vite-plugin.test.ts

Expected: FAIL because the plugin does not exist.

- [ ] **Step 3: Implement catalog-backed Vite plugin**

On buildStart, call loadWebBootGraph(resolve(process.cwd(), 'cordis.yml')) once. Resolve virtual:cordis-web-boot to a null-byte Vite ID and return literal imports:

    import type { PluginRegistry } from '@yunzhen/cordis-client-modules'
    const load0 = () => import('@yunzhen/cordis-ui-renderer/client')
    const load1 = () => import('@yunzhen/cordis-ui-router/client')
    export const graph = { revision: '...', entries: [] } as const
    export const registry: PluginRegistry = new Map([
      ['@yunzhen/cordis-ui-renderer', load0],
      ['@yunzhen/cordis-ui-router', load1],
    ])

In generateBundle(), emit an asset named cordis.boot.json with JSON.stringify(graph, null, 2). Register this plugin before react() in vite.config.ts.

- [ ] **Step 4: Add configuration and exact package metadata**

Create cordis.yml:

    - id: renderer
      name: '@yunzhen/cordis-ui-renderer'
    - id: router
      name: '@yunzhen/cordis-ui-router'
    - id: layout
      name: '@yunzhen/cordis-ui-layout'
    - id: theme
      name: '@yunzhen/cordis-ui-theme'
    - id: dashboard
      name: '@yunzhen/cordis-feature-dashboard'
    - id: settings
      name: '@yunzhen/cordis-feature-settings'

Convert each current string export to object form retaining "." and adding "./client" for the same source. Set inject metadata: renderer []; router [@yunzhen/cordis-ui-renderer]; layout [@yunzhen/cordis-ui-router]; theme [@yunzhen/cordis-ui-renderer]; dashboard [@yunzhen/cordis-ui-layout]; settings [@yunzhen/cordis-ui-router]. Set renderer immediately true and every other package false.

- [ ] **Step 5: Switch main and delete old bundle**

Replace apps/web/src/main.tsx with:

    import { bootWebApp } from '@yunzhen/cordis-client-modules'
    import { graph, registry } from 'virtual:cordis-web-boot'

    void bootWebApp({
      container: document.getElementById('root')!,
      graph,
      registry,
    }).catch(error => console.error(error))

Add direct workspace dependencies in apps/web/package.json for client-modules and all six configured packages; remove cordis-bundle-web-app. Remove its path alias from tsconfig.json and delete its package files without a compatibility re-export.

- [ ] **Step 6: Verify migration and commit**

Run:

    CI=true pnpm exec vitest run apps/web/vite-plugin.test.ts packages/client/modules/src/boot.test.tsx
    CI=true pnpm typecheck
    CI=true pnpm build
    node --input-type=module -e "import { readFile } from 'node:fs/promises'; const graph = JSON.parse(await readFile('apps/web/dist/cordis.boot.json', 'utf8')); if (graph.entries.length !== 6) throw new Error('expected six boot entries')"
    git diff --check

Expected: PASS.

    git add cordis.yml apps/web packages/client/modules packages/host/plugin-catalog packages/ui/renderer/package.json packages/ui/router/package.json packages/ui/layout/package.json packages/ui/theme/package.json packages/feature/dashboard/package.json packages/feature/settings/package.json tsconfig.json pnpm-lock.yaml
    git add -u packages/bundle/web-app
    git commit -m "feat: boot web plugins from catalog"

### Task 4: Prove disabled behavior and document the boundary

**Files:**
- Modify: packages/host/plugin-catalog/src/index.test.ts
- Modify: packages/client/modules/src/boot.test.tsx
- Modify: apps/web/index.test.ts
- Modify: docs/architecture.md

- [ ] **Step 1: Add disabled-Dashboard integration coverage**

Use a graph without Dashboard and a registry whose Dashboard loader increments dashboardImports. Assert:

    await activateWebBootGraph(ctx, graphWithoutDashboard, registry)
    expect(dashboardImports).toBe(0)
    expect(activated).toEqual(['renderer', 'router', 'settings'])

Also assert disabled: true removes Dashboard before topology validation.

- [ ] **Step 2: Verify the integration coverage passes**

Run: CI=true pnpm exec vitest run packages/host/plugin-catalog/src/index.test.ts packages/client/modules/src/boot.test.tsx

Expected: PASS because Task 1 removes disabled rows and Task 2 imports only graph rows.

- [ ] **Step 3: Complete behavior and update docs**

Keep apps/web/index.html theme bootstrap unchanged; it prevents flash before the Theme plugin activates. Preserve apps/web/index.test.ts persisted-font-size tests. Replace docs/architecture.md fixed-array description with:

    cordis.yml -> host/plugin-catalog -> WebBootGraph
      -> Vite virtual registry (dev) / cordis.boot.json + chunks (build)
      -> client/modules Boot Loader -> Cordis Context -> uiRenderer.mount()

Document that production serves dist statically and Node scanning, HMR, remote plugins, !!js, and runtime plugin installation are unsupported.

- [ ] **Step 4: Run final verification and commit**

Run:

    CI=true pnpm test
    CI=true pnpm typecheck
    CI=true pnpm build
    git diff --check
    git status --short

Then run pnpm dev, verify Dashboard, Settings, and Appearance. Temporarily change Dashboard to disabled: true, verify the normal Vite full reload leaves no Dashboard route, restore the enabled file, then commit:

    git add docs/architecture.md packages/host/plugin-catalog/src/index.test.ts packages/client/modules/src/boot.test.tsx apps/web/index.test.ts
    git commit -m "docs: describe catalog web boot"

## Final verification checklist

- cordis.yml is the only enabled-plugin source and no webAppPlugins symbol remains.
- Catalog rejects duplicate entries, missing dependencies, cycles, YAML JavaScript tags, and non-JSON config.
- Dev generates the same graph emitted to dist/cordis.boot.json.
- Production starts from static Vite chunks without a Node application server.
- Catalog, import, and activation failures include YAML entry id and phase; UI never mounts after failure.
