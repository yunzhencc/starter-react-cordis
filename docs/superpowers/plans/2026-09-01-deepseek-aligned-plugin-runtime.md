# DeepSeek 对齐插件运行时 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 DeepSeek Harness 的 Cordis Service、Fiber 与 Slot 生命周期模型替换当前自定义运行时，并将 Dashboard / Settings 迁移到可嵌套的 React Router Layout Route。

**Architecture:** `ui-renderer` 安装 `ctx.slots` 并挂载根 Slot；`ui-router` 安装 `ctx.routes`、占据根 Slot 且将 Route 定义转为 React Router 树；`ui-layout` 仅贡献无路径 `app-layout` Route。所有业务功能使用 `inject + apply` 贡献 Route 或 Slot，资源由调用方 Fiber 的 `ctx.effect()` 管理。未来动态加载只落地类型协议，不安装 Provider 或 Loader。

**Tech Stack:** TypeScript 6、React 19、React Router DOM 7、`@deepseek-ai/cordis` 4、Vite 8、Vitest 4、CSS Modules。

**Spec:** `docs/superpowers/specs/2026-09-01-deepseek-aligned-plugin-runtime-design.md`

## Global Constraints

- 所有公开包名使用 `@yunzhen/cordis-*`；不保留旧包名兼容层。
- 不新增第三方依赖；不实现 Provider、浏览器懒 CJS、HMR、session scope、keyed/chain Slot 或 store factory。
- 插件只导出 Cordis `{ inject, apply }`；不保留 `AppPlugin`、`AppContext`、`AppRuntime`、React Runtime Provider。
- `register()` / `inject()` 必须通过调用者 Context 的 `ctx.effect()` 绑定 Fiber 生命周期。
- 对齐 Harness 的失败语义：非法注册同步失败；失败的 `inject()` 停止而不自动重试；不引入全局回滚事务。
- Route 是 Router 领域对象，不是 Slot kind；`children` 表示页面 Slot 声明，路由树用 `parentId` 表示。
- V1 三栏只支持 `{ sidebarOpen, workbenchOpen }`，两侧完全隐藏；不持久化、拖拽或响应式自动折叠。

---

## File structure

| 路径 | 责任 |
|---|---|
| `packages/client/modules/src/index.ts` | `WebBootGraph` 与 `PluginCatalogProvider` 类型协议，首版无运行时代码。 |
| `packages/ui/slots/src/index.ts` | 纯 SlotMap / SlotCore：声明、占位、级联清理与声明监听。 |
| `packages/ui/renderer/src/registry.ts` | `SlotRegistry extends Service`、调用者 Fiber effect、Slot owner 与声明注入。 |
| `packages/ui/renderer/src/index.tsx` | `ctx.slots`、`ctx.uiRenderer.mount()`、React Slot context / `<Slot />`。 |
| `packages/ui/router/src/routes.ts` | `RouteRegistry extends Service`、父 Route 等待、校验、快照与订阅。 |
| `packages/ui/router/src/index.tsx` | root Router host、RouteSlotOwner、`RouteOutlet` 与 sidebar navigation 贡献。 |
| `packages/ui/layout/src/index.tsx` | `app-layout` Route、LayoutController、AppLayout 三栏与 CSS。 |
| `packages/feature/*`、`packages/ui/theme` | 迁移后的业务 `inject + apply` 贡献。 |
| `packages/bundle/web-app/src/index.ts`、`apps/web/src/main.tsx` | 静态 Cordis 模块组合和 renderer-owned 启动。 |

旧 `packages/core/runtime`、`packages/react/bridge`、`packages/router/react-router`、`packages/ui/shell` 在迁移完成后删除；它们不得与新包同时保留。

### Task 1: Add the future module-catalog contract and package metadata

**Files:**
- Create: `packages/client/modules/package.json`
- Create: `packages/client/modules/src/index.ts`
- Create: `packages/client/modules/src/index.test.ts`

**Interfaces:**
- Produces `WebBootGraph`, `WebBootEntry`, and `PluginCatalogProvider` from `@yunzhen/cordis-client-modules`.
- Does not consume any new runtime dependency.

- [ ] **Step 1: Write the failing contract test**

```ts
import type { PluginCatalogProvider, WebBootGraph } from './index'
import { expectTypeOf, it } from 'vitest'

it('models a DeepSeek-compatible boot graph', () => {
  const graph: WebBootGraph = {
    revision: 'r1',
    entries: [{ id: '@yunzhen/cordis-ui-layout', url: '/plugins/layout.js?rev=r1', rev: 'r1', inject: ['@yunzhen/cordis-ui-router'] }],
  }
  const provider: PluginCatalogProvider = { id: 'static', snapshot: async () => graph }
  expectTypeOf(provider.snapshot).returns.toEqualTypeOf<Promise<WebBootGraph>>()
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run packages/client/modules/src/index.test.ts`

Expected: FAIL because `@yunzhen/cordis-client-modules` and its exported types do not exist.

- [ ] **Step 3: Create the type-only package and metadata**

```ts
export interface WebBootEntry {
  id: string
  url: string
  rev: string
  inject?: readonly string[]
  immediately?: boolean
  external?: readonly string[]
}

export interface WebBootGraph {
  revision: string
  entries: readonly WebBootEntry[]
}

export interface PluginCatalogProvider {
  id: string
  snapshot(): Promise<WebBootGraph>
  watch?(onChange: () => void): () => void
}
```

Create `packages/client/modules/package.json` with name `@yunzhen/cordis-client-modules`, ESM source export, and no dependencies. Add `yunzhen.client` metadata when each client plugin package is created or migrated in Tasks 3–6; this keeps every commit buildable.

- [ ] **Step 4: Run the contract test and typecheck**

Run: `pnpm vitest run packages/client/modules/src/index.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/client/modules
git commit -m "feat: add client module catalog contract"
```

### Task 2: Replace the custom runtime with the pure Slot core

**Files:**
- Create: `packages/ui/slots/package.json`
- Create: `packages/ui/slots/src/index.ts`
- Create: `packages/ui/slots/src/index.test.ts`

**Interfaces:**
- Produces `SlotMap`, `SlotSpec`, `SlotEntry`, and `SlotCore` from `@yunzhen/cordis-ui-slots`.
- `SlotCore.register({ name, children? }, component)` returns an idempotent disposer.
- `SlotCore.subscribeDeclaration(name, listener)` supplies declaration epoch changes to renderer code.

- [ ] **Step 1: Write failing SlotCore lifecycle tests**

```ts
it('cascades a declarer disposal through descendants and contributions', () => {
  const core = new SlotCore()
  const disposeFrame = core.register({ name: 'root', children: { host: { kind: 'single', scope: 'root' } } }, Null)
  core.register({ name: 'host', children: { row: { kind: 'list', scope: 'root' } } }, Null)
  core.register({ name: 'row', id: 'theme' }, Null)
  disposeFrame()
  expect(core.spec('host')).toBeUndefined()
  expect(core.entries('row')).toEqual([])
})

it('rejects an undeclared target and duplicate declaration', () => {
  const core = new SlotCore()
  expect(() => core.register({ name: 'missing' }, Null)).toThrow('not declared')
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run packages/ui/slots/src/index.test.ts`

Expected: FAIL because the package and `SlotCore` do not exist.

- [ ] **Step 3: Implement the minimal pure core**

Seed `root` as `{ kind: 'single', scope: 'root' }`. Store declarations and entries in one ledger. Implement only `single` and `list`; list entries require `id` and sort by `order ?? 0` with registration order as the stable tie-breaker. On entry disposal, recursively remove declarations owned by that entry and all descendants; stale entry disposers must return without error. Expose `spec()`, `entries()`, `declarationEpoch()`, and `subscribeDeclaration()` for the renderer.

Do not import Cordis or React runtime code in this package; React component types may be structural `ComponentType` imports only.

- [ ] **Step 4: Run SlotCore tests and typecheck**

Run: `pnpm vitest run packages/ui/slots/src/index.test.ts && pnpm typecheck`

Expected: PASS; the old runtime remains intact until Task 6 switches every consumer to the new packages.

- [ ] **Step 5: Commit the Slot core**

```bash
git add packages/ui/slots
git commit -m "feat: add slot core lifecycle"
```

### Task 3: Add the renderer-owned Slot service and root mount

**Files:**
- Create: `packages/ui/renderer/package.json`
- Create: `packages/ui/renderer/src/index.tsx`
- Create: `packages/ui/renderer/src/registry.ts`
- Create: `packages/ui/renderer/src/index.test.tsx`

**Interfaces:**
- Consumes `SlotCore` from Task 2 and `Context`, `Service` from `@deepseek-ai/cordis`.
- Produces `ctx.slots`, `ctx.uiRenderer`, `<Slot name="…" />`, and `SlotRegistry.register()` / `SlotRegistry.inject()`.
- `SlotRegistry.createOwner(id, children)` is renderer-internal plumbing used by Task 4; it returns `{ render(name): ReactNode, dispose(): void }` and is not added to the public feature-plugin API.

- [ ] **Step 1: Write failing caller-Fiber and injection tests**

```tsx
it('removes a contribution when its caller fiber is disposed', async () => {
  const ctx = await bootRenderer()
  ctx.slots.register({ name: 'root', children: { host: { kind: 'single', scope: 'root' } } }, Null)
  const fiber = ctx.plugin({ inject: ['slots'], apply(pluginCtx) {
    pluginCtx.slots.register({ name: 'host' }, Null)
  } })
  await fiber.await()
  await fiber.dispose()
  expect(ctx.slots.entries('host')).toEqual([])
})

it('stops an injection after its callback throws', async () => {
  const ctx = await bootRenderer()
  let runs = 0
  const disposeRoot = ctx.slots.register({ name: 'root', children: { host: { kind: 'single', scope: 'root' } } }, Null)
  expect(() => ctx.slots.inject('host', () => { runs += 1; throw new Error('broken') })).toThrow('broken')
  disposeRoot()
  ctx.slots.register({ name: 'root', children: { host: { kind: 'single', scope: 'root' } } }, Null)
  expect(runs).toBe(1)
})
```

- [ ] **Step 2: Run the renderer tests and verify they fail**

Run: `pnpm vitest run packages/ui/renderer/src/index.test.tsx`

Expected: FAIL because `ctx.slots` and `ctx.uiRenderer` are not installed.

- [ ] **Step 3: Implement `SlotRegistry` and renderer React context**

Make `SlotRegistry` extend `Service` with key `slots`. Keep `register` as a prototype method whose first operation is `this.ctx.effect(() => core.register(...), 'slots.register()')`; do not use an arrow property. Implement `inject()` with a declaration subscription and nested caller effect: dispose the active callback on epoch change, run it for the new declaration, and permanently stop on callback failure.

Install `<Slot />` through a React owner context. It throws when rendered without an owner or for an undeclared child. `uiRenderer.mount(container)` creates a React root whose only content is the rendered `root` Slot; return its unmount disposer.

Set the new package manifest name to `@yunzhen/cordis-ui-renderer` and add `yunzhen.client` with `platform: "web"`, empty `inject` / `external`, and `immediately: false`.

- [ ] **Step 4: Run renderer tests and package checks**

Run: `pnpm vitest run packages/ui/renderer/src/index.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the renderer service**

```bash
git add packages/ui/renderer packages/ui/slots
git commit -m "feat: add renderer slot service"
```

### Task 4: Add the Route service and React Router host

**Files:**
- Create: `packages/ui/router/package.json`
- Create: `packages/ui/router/src/routes.ts`
- Create: `packages/ui/router/src/index.tsx`
- Create: `packages/ui/router/src/routes.test.ts`
- Create: `packages/ui/router/src/index.test.tsx`

**Interfaces:**
- Consumes `ctx.slots` from Task 3.
- Produces `ctx.routes: RouteRegistry` with `register()`, `inject()`, `snapshot()`, `subscribe()`.
- Produces `RouteDefinition`:

```ts
interface RouteDefinition {
  id: string
  parentId?: string
  path?: string
  index?: boolean
  Component: ComponentType
  navigation?: { label: string, order: number }
  children?: Record<string, SlotSpec>
}
```

- [ ] **Step 1: Write failing RouteRegistry lifecycle tests**

```ts
it('waits for a parent route then removes the child with its caller fiber', async () => {
  const ctx = await bootRoutes()
  const child = ctx.plugin({ inject: ['routes'], apply(pluginCtx) {
    pluginCtx.routes.inject('app-layout', () => pluginCtx.routes.register({
      id: 'settings', parentId: 'app-layout', path: 'settings', Component: Null,
    }))
  } })
  await child.await()
  ctx.routes.register({ id: 'app-layout', Component: Null })
  expect(ctx.routes.snapshot().map(route => route.id)).toEqual(['app-layout', 'settings'])
  await child.dispose()
  expect(ctx.routes.snapshot().map(route => route.id)).toEqual(['app-layout'])
})

it.each([
  [{ id: 'same', Component: Null }, { id: 'same', Component: Null }],
  [{ id: 'index', index: true, path: 'bad', Component: Null }],
])('rejects invalid route definitions', (routes) => {
  expect(() => routes.forEach(route => registry.register(route))).toThrow()
})
```

- [ ] **Step 2: Run RouteRegistry tests and verify they fail**

Run: `pnpm vitest run packages/ui/router/src/routes.test.ts`

Expected: FAIL because `RouteRegistry` does not exist.

- [ ] **Step 3: Implement RouteRegistry and its validation**

Extend `Service` with key `routes`. Keep `register` and `inject` prototype methods using caller `ctx.effect`. Validate unique ids, known `parentId`, no parent cycle, `index` / `path` exclusivity, non-empty relative paths, and one index child per parent. `inject(parentId, callback)` mirrors `slots.inject`: it awaits parent presence, rebuilds on parent epoch change, and stops after callback failure.

In `apply`, construct the registry and register one root-slot `RouterRoot`. `RouterRoot` uses `BrowserRouter`, `useSyncExternalStore(ctx.routes.subscribe, ctx.routes.snapshot)`, and `useRoutes()`. Convert each definition to a React Router object wrapped by `RouteSlotOwner`; that wrapper creates the renderer-internal owner from the route's `children` and provides it to `<Slot />`. Add an internal `RouteOutlet` contribution using `ctx.slots.inject('main', ...)`; it renders `<Outlet />`. Add a `NavigationSidebar` contribution using `ctx.slots.inject('sidebar', ...)`; it declares and renders `sidebar.navigation` / `sidebar.footer` and derives `NavLink` entries from the route snapshot.

Set the new package manifest name to `@yunzhen/cordis-ui-router`, depend only on `@yunzhen/cordis-ui-renderer`, `@yunzhen/cordis-ui-slots`, Cordis, React, and React Router DOM, and add the standard `yunzhen.client` declaration.

- [ ] **Step 4: Write and run the Router host tests**

```tsx
it('renders a pathless layout and its settings child through the main slot', async () => {
  window.history.replaceState({}, '', '/settings')
  const { ctx, container } = await bootRouterWithLayout()
  const unmount = ctx.uiRenderer.mount(container)
  await act(async () => {})
  expect(container.querySelector('h1')?.textContent).toBe('Settings')
  unmount()
})

it('renders a route-declared settings slot inside its matched page', async () => {
  window.history.replaceState({}, '', '/settings')
  const { ctx, container } = await bootRouterWithSettingsSlot()
  const unmount = ctx.uiRenderer.mount(container)
  await act(async () => {})
  expect(container.textContent).toContain('Appearance')
  unmount()
})
```

Run: `pnpm vitest run packages/ui/router/src/routes.test.ts packages/ui/router/src/index.test.tsx`

Expected: PASS, including pathless parent / nested child rendering and route-owned Slot rendering.

- [ ] **Step 5: Commit the router package migration**

```bash
git add packages/ui/router packages/router/react-router
git commit -m "feat: add route registry and router host"
```

### Task 5: Convert Shell into the app-layout Route

**Files:**
- Create: `packages/ui/layout/package.json`
- Create: `packages/ui/layout/src/index.tsx`
- Create: `packages/ui/layout/src/index.module.css`
- Create: `packages/ui/layout/src/layout-controller.ts`
- Create: `packages/ui/layout/src/index.test.tsx`

**Interfaces:**
- Consumes `ctx.routes`, `ctx.slots`, `<Slot />` from Tasks 3–4.
- Produces `ctx.layout` with `toggleSidebar()`, `openWorkbench()`, `closeWorkbench()`, `toggleWorkbench()`, `snapshot()`, `subscribe()`.
- Produces pathless route id `app-layout` with Slots `sidebar`, `main`, `workbench`, `shell.overlay`.

- [ ] **Step 1: Write failing layout state and rendering tests**

```tsx
it('fully hides the sidebar and lets main fill the frame', async () => {
  const { ctx, container } = await bootLayout()
  ctx.layout.toggleSidebar()
  const unmount = ctx.uiRenderer.mount(container)
  await act(async () => {})
  expect(container.querySelector('[data-app-layout]')?.getAttribute('data-sidebar-open')).toBe('false')
  expect(container.querySelector('[data-sidebar-column]')).toBeNull()
  unmount()
})

it('keeps workbench hidden without an occupant and closes it on request', async () => {
  const { ctx, container } = await bootLayout()
  const unmount = ctx.uiRenderer.mount(container)
  await act(async () => {})
  expect(container.querySelector('[data-workbench-column]')).toBeNull()
  ctx.slots.register({ name: 'workbench' }, Workbench)
  ctx.layout.openWorkbench()
  await act(async () => {})
  expect(container.querySelector('[data-workbench-column]')).not.toBeNull()
  ctx.layout.closeWorkbench()
  await act(async () => {})
  expect(container.querySelector('[data-workbench-column]')).toBeNull()
  unmount()
})
```

- [ ] **Step 2: Run layout tests and verify they fail**

Run: `pnpm vitest run packages/ui/layout/src/index.test.tsx`

Expected: FAIL because `app-layout` and `ctx.layout` do not exist.

- [ ] **Step 3: Implement LayoutController and AppLayout**

Implement a minimal observable `LayoutController` with an in-memory `LayoutSnapshot`; it is the V1 replacement for Harness's store-backed panel state and is deliberately limited to the two confirmed booleans. In `apply`, provide it with `ctx.reflect.provide('layout', controller)` inside an effect, then register the pathless `app-layout` Route with its Slot declarations.

`AppLayout` renders `<Slot name="sidebar" />`, `<Slot name="main" />`, `<Slot name="workbench" />`, and `<Slot name="shell.overlay" />`. CSS must omit the sidebar/workbench elements entirely when closed; main uses the whole remaining grid. The router-owned sidebar contribution from Task 4 occupies `sidebar` and owns its navigation/footer descendants.

Set the new package manifest name to `@yunzhen/cordis-ui-layout`, depend on the renderer/router/slots packages plus Cordis and React, and add the standard `yunzhen.client` declaration.

- [ ] **Step 4: Run layout and Router integration tests**

Run: `pnpm vitest run packages/ui/layout/src/index.test.tsx packages/ui/router/src/index.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the Layout migration**

```bash
git add packages/ui/layout packages/ui/shell packages/ui/router
git commit -m "feat: add app layout route"
```

### Task 6: Migrate built-in features, theme, static bundle, and web boot

**Files:**
- Modify: `packages/feature/dashboard/src/index.tsx`
- Modify: `packages/feature/dashboard/package.json`
- Modify: `packages/feature/settings/src/index.tsx`
- Modify: `packages/feature/settings/src/index.test.tsx`
- Modify: `packages/feature/settings/package.json`
- Modify: `packages/ui/theme/src/index.ts`
- Modify: `packages/ui/theme/src/index.test.ts`
- Modify: `packages/ui/theme/package.json`
- Modify: `packages/bundle/web-app/src/index.ts`
- Modify: `packages/bundle/web-app/src/index.test.ts`
- Modify: `packages/bundle/web-app/package.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/package.json`
- Delete: `packages/core/runtime/package.json`
- Delete: `packages/core/runtime/src/index.ts`
- Delete: `packages/core/runtime/src/runtime.ts`
- Delete: `packages/core/runtime/src/runtime.test.ts`
- Delete: `packages/react/bridge/package.json`
- Delete: `packages/react/bridge/src/index.tsx`
- Delete: `packages/router/react-router/package.json`
- Delete: `packages/router/react-router/src/index.tsx`
- Delete: `packages/router/react-router/src/index.test.tsx`
- Delete: `packages/router/react-router/src/not-found-page.tsx`
- Delete: `packages/router/react-router/src/route-error-page.tsx`
- Delete: `packages/ui/shell/package.json`
- Delete: `packages/ui/shell/src/index.tsx`
- Delete: `packages/ui/shell/src/index.module.css`
- Delete: `packages/ui/shell/src/index.test.tsx`
- Delete: `packages/ui/shell/src/navigation.ts`
- Delete: `packages/ui/shell/src/navigation.test.ts`
- Delete: `packages/ui/theme/src/theme-toggle.tsx`
- Delete: `packages/ui/theme/src/theme-toggle.test.tsx`

**Interfaces:**
- Consumes `ctx.routes`, `ctx.slots`, `ctx.uiRenderer`, `ctx.layout` from Tasks 3–5.
- Produces `webAppPlugins` as readonly Cordis module objects, in base-first order: renderer, router, layout, theme, dashboard, settings.
- Settings declares `settings.section`; theme contributes Appearance through `ctx.slots.inject('settings.section', ...)`.

- [ ] **Step 1: Rewrite the existing feature tests as failing Cordis-module tests**

```tsx
it('registers settings below app-layout and renders its Appearance section', async () => {
  const { ctx, container } = await bootBuiltInModules('/settings')
  expect(ctx.routes.snapshot().find(route => route.id === 'settings')).toMatchObject({ parentId: 'app-layout', path: 'settings' })
  const unmount = ctx.uiRenderer.mount(container)
  await act(async () => {})
  expect(container.querySelector('h1')?.textContent).toBe('Settings')
  expect(container.textContent).toContain('Appearance')
  unmount()
})

it('keeps Dashboard as the app-layout index child', async () => {
  const { ctx } = await bootBuiltInModules('/')
  expect(ctx.routes.snapshot().find(route => route.id === 'dashboard')).toMatchObject({ parentId: 'app-layout', index: true })
})
```

- [ ] **Step 2: Run built-in tests and verify they fail**

Run: `pnpm vitest run packages/feature/settings/src/index.test.tsx packages/bundle/web-app/src/index.test.ts`

Expected: FAIL because features still import `AppPlugin`, `useRuntime`, and global Settings item collection.

- [ ] **Step 3: Implement feature and theme migration**

Change every plugin to `export const inject = [...]` and `export function apply(ctx)`. Dashboard and Settings use `ctx.routes.inject('app-layout', ...)`; Settings declares `settings.section` and renders `<Slot name="settings.section" />`. Theme uses `ctx.effect()` for style lifecycle, provides `theme` through Cordis reflection, and uses `ctx.slots.inject('settings.section', ...)` to register the Appearance component. Remove `ThemeToggle`'s former `shell.content.header` contribution and remove all `settingsItems` use.

Update the Dashboard, Settings, and Theme manifests to retain their `@yunzhen/cordis-*` names, replace legacy workspace dependencies with the new renderer/router/slots/layout packages they import, and add the standard `yunzhen.client` declaration.

Update `webAppPlugins` to a static Cordis module list. In `apps/web/src/main.tsx`, create `new Context()`, install each module, await its Fiber, then call `ctx.uiRenderer.mount(document.getElementById('root')!)`. Remove `RuntimeProvider`, `createAppRuntime`, `createAppRouter`, `RouterProvider`, and all workspace dependencies on deleted packages.

- [ ] **Step 4: Run feature, bundle, and application tests**

Run: `pnpm vitest run packages/feature/settings/src/index.test.tsx packages/ui/theme/src/index.test.ts packages/bundle/web-app/src/index.test.ts apps/web/index.test.ts`

Expected: PASS; Dashboard and Settings work through the new static Cordis module boot path.

- [ ] **Step 5: Commit the built-in migration and removals**

```bash
git add -A packages/feature packages/ui/theme packages/bundle apps/web packages/core/runtime packages/react/bridge packages/router/react-router packages/ui/shell
git commit -m "feat: migrate built-in modules to cordis services"
```

### Task 7: Run repository-wide verification and remove stale contracts

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-09-01-layout-slots-design.md`
- Modify: `docs/superpowers/specs/2026-09-01-route-contributions-design.md`

**Interfaces:**
- Consumes the completed static runtime from Tasks 1–6.
- Produces documentation that identifies `2026-09-01-deepseek-aligned-plugin-runtime-design.md` as the active architecture and marks older custom-runtime specs superseded.

- [ ] **Step 1: Verify legacy package references are absent**

Run: `rg -n '@yunzhen/cordis-(runtime|react-bridge|react-router|ui-shell)' --glob '!docs/**' --glob '!pnpm-lock.yaml' .`

Expected: exit status 1 with no output. Any match is a migration defect and must be removed before documentation or final verification.

- [ ] **Step 2: Update architecture documentation and supersession notes**

Document the static V1 boot chain, package ownership, root-only Slot limit, pathless `app-layout`, and type-only future `WebBootGraph` contract. Add a short supersession note to the two older specs; do not delete historical design documents.

- [ ] **Step 3: Run the complete verification suite**

Run: `pnpm test && pnpm typecheck && pnpm build && git diff --check`

Expected: all commands succeed with no TypeScript errors, test failures, build failures, or whitespace errors.

- [ ] **Step 4: Commit verification documentation**

```bash
git add docs packages/bundle/web-app/src/index.test.ts
git commit -m "docs: finalize plugin runtime architecture"
```

## Plan self-review

- Spec coverage: Tasks 2–3 implement DeepSeek-aligned Slot ownership and caller-Fiber lifecycle; Task 4 implements the minimal Router extension; Task 5 implements the pathless three-column Layout; Task 6 preserves Dashboard, Settings, Appearance, and static startup; Task 1 fixes the future boot-graph contract; Task 7 verifies and records the replacement.
- Deliberate exclusions: no Node/CDN Provider, lazy CJS runtime, HMR, dynamic third-party installation, session scopes, keyed/chain slots, store factory, layout persistence, drag resize, or responsive auto-collapse.
- Type consistency: `WebBootGraph` is only in `client-modules`; `SlotSpec` is only in `ui-slots`; `RouteDefinition` and `RouteRegistry` are only in `ui-router`; feature modules consume only Context service augmentations.
