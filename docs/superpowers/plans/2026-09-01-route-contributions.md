# Route Contributions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat page contributions with validated nested route trees, then render them through React Router and the application shell.

**Architecture:** Runtime owns framework-neutral `RouteNode` collection and validation. The React Router package converts route trees into one static browser router with root, error, and not-found routes; Shell derives sidebar entries from the same tree. Feature packages only contribute route trees.

**Tech Stack:** TypeScript 6, React 19, React Router 7, Vite 8, Vitest 4, jsdom, `@deepseek-ai/cordis` 4.

**Spec:** `docs/superpowers/specs/2026-09-01-route-contributions-design.md`

## Global Constraints

- Remove `Page`, `addPage()`, and `AppRuntime.pages`; do not retain a compatibility layer.
- Keep Core independent of React Router `RouteObject`, `loader`, `action`, `handle`, permissions, page titles, and dynamic route installation.
- `RouteNode.path` is relative; Dashboard is an index route and Settings uses `settings`.
- `navigation.order` is required; route registration order must not determine navigation order.
- Routes remain static after startup. No third-party plugins, Sass/Less/Tailwind/CSS-in-JS, event bus, or module loader.

---

### Task 1: Replace flat pages with validated route contributions

**Files:**
- Modify: `packages/core/runtime/src/runtime.ts`
- Modify: `packages/core/runtime/src/runtime.test.ts`

**Interfaces:**

```ts
export interface RouteNavigation { label: string, order: number }
export interface RouteNode {
  id: string
  Component: ComponentType
  path?: string
  index?: boolean
  ErrorComponent?: ComponentType
  children?: readonly RouteNode[]
  navigation?: RouteNavigation
}
// AppContext.addRoute(route): () => void
// AppRuntime.routes: readonly RouteNode[]
```

- [ ] **Step 1: Write failing runtime tests**

  Replace page tests with an index Dashboard route and nested route tree test. Add table-driven invalid trees that reject `createAppRuntime()` with messages containing the problem:

  ```ts
  await expect(createAppRuntime([(app) => app.addRoute({
    id: 'invalid', path: '/settings', Component: () => null,
  })])).rejects.toThrow('relative')
  ```

  Cover duplicate ids across levels, `index` plus `path`, two index siblings, duplicate sibling paths, `.`/`..` paths, and navigation without index/path. Also assert a route disposer removes only its own top-level node.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `CI=true pnpm test -- packages/core/runtime/src/runtime.test.ts`

  Expected: FAIL because `RouteNode`, `addRoute`, and `routes` do not exist.

- [ ] **Step 3: Implement route collection and recursive validation**

  Remove the `Page` interface and `pages` array. Add `routes`, `addRoute`, and a private recursive validator called after all Cordis plugin fibers are ready. Validation must use sibling-local tracking for paths and index nodes plus one shared `Set` for ids. A valid non-index node must have a non-empty path not beginning with `/` and not equal to `.` or `..`; every node already has a required `Component` by TypeScript contract.

  Return a copied `routes` array. Preserve existing Settings and typed-service behavior unchanged.

- [ ] **Step 4: Run focused runtime tests**

  Run: `CI=true pnpm test -- packages/core/runtime/src/runtime.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit the runtime seam**

  ```bash
  git add packages/core/runtime/src/runtime.ts packages/core/runtime/src/runtime.test.ts
  git commit -m "feat: add route tree contributions"
  ```

### Task 2: Convert route trees into React Router routes

**Files:**
- Modify: `packages/router/react-router/src/index.tsx`
- Modify: `packages/router/react-router/src/index.test.tsx`
- Create: `packages/router/react-router/src/not-found-page.tsx`
- Create: `packages/router/react-router/src/route-error-page.tsx`

**Interfaces:**
- Consumes `AppRuntime.routes` and `RouteNode`.
- Produces `createAppRouter(runtime)` with one `AppShell` root, recursive children, and a final `path: '*'` child.

- [ ] **Step 1: Write failing recursive conversion tests**

  Register a parent route with `path: 'workspace'`, a child `index: true`, a child `path: ':id'`, and an `ErrorComponent`. Assert the resulting root has `AppShell`, mapped nested children, mapped `ErrorBoundary`, and a final wildcard route. Keep the test route components local; do not add example application pages.

- [ ] **Step 2: Run focused router tests and verify failure**

  Run: `CI=true pnpm test -- packages/router/react-router/src/index.test.tsx`

  Expected: FAIL because the adapter reads removed `runtime.pages`.

- [ ] **Step 3: Implement one recursive adapter**

  Add `toReactRouterRoute(route: RouteNode)` inside the router package. It maps `Component`, optional `ErrorComponent` to `ErrorBoundary`, `index`, optional `path`, and recursive `children`. `createAppRouter()` must create exactly one root with `Component: AppShell`, `ErrorBoundary: RouteErrorPage`, converted `runtime.routes`, and `{ path: '*', Component: NotFoundPage }` appended last.

- [ ] **Step 4: Run focused router tests**

  Run: `CI=true pnpm test -- packages/router/react-router/src/index.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit router conversion**

  ```bash
  git add packages/router/react-router/src
  git commit -m "feat: map route contributions to React Router"
  ```

### Task 3: Derive Shell navigation from route metadata

**Files:**
- Modify: `packages/ui/shell/src/index.tsx`
- Create: `packages/ui/shell/src/navigation.ts`
- Create: `packages/ui/shell/src/navigation.test.ts`
- Create: `packages/ui/shell/src/index.test.tsx`

**Interfaces:**
- Consumes `readonly RouteNode[]`.
- Produces `getNavigationItems(routes): readonly { id: string, label: string, path: string }[]`.

- [ ] **Step 1: Write failing navigation helper tests**

  Test a root index route, `settings`, a non-navigable `workspace` layout, and nested `workspace/:id` navigation. Assert paths are `/`, `/settings`, `/workspace/:id`; entries sort by `navigation.order`; nodes without `navigation` are absent.

- [ ] **Step 2: Run helper test and verify failure**

  Run: `CI=true pnpm test -- packages/ui/shell/src/navigation.test.ts`

  Expected: FAIL because `getNavigationItems` does not exist.

- [ ] **Step 3: Implement the local navigation helper and use it**

  Recursively join non-index relative paths with a single leading `/`; index inherits its parent path. Collect only navigable nodes, sort numerically by `order`, and return immutable values. `AppShell` calls this helper on `runtime.routes`; root uses `end`, other links retain partial active matching.

- [ ] **Step 4: Run focused shell tests**

  Run: `CI=true pnpm test -- packages/ui/shell/src/navigation.test.ts`

  Expected: PASS.

- [ ] **Step 5: Verify root-link active behavior with a Memory Router**

  Render `AppShell` inside `RuntimeProvider` and a `MemoryRouter` at `/settings`; assert Dashboard does not receive the active class while Settings does. Use a container-scoped query and cleanup after the test so the router state does not leak between tests.

- [ ] **Step 6: Commit navigation derivation**

  ```bash
  git add packages/ui/shell/src/index.tsx packages/ui/shell/src/navigation.ts packages/ui/shell/src/navigation.test.ts packages/ui/shell/src/index.test.tsx
  git commit -m "feat: derive shell navigation from routes"
  ```

### Task 4: Migrate built-in features and verify the assembled app

**Files:**
- Modify: `packages/feature/dashboard/src/index.tsx`
- Modify: `packages/feature/settings/src/index.tsx`
- Modify: `packages/bundle/web-app/src/index.test.ts`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the bundle test first**

  Replace page assertions with route assertions:

  ```ts
  expect(runtime.routes.map(({ id, path, index, navigation }) => [id, path, index, navigation?.order])).toEqual([
    ['dashboard', undefined, true, 0],
    ['settings', 'settings', undefined, 100],
  ])
  ```

- [ ] **Step 2: Run the focused bundle test and verify failure**

  Run: `CI=true pnpm test -- packages/bundle/web-app/src/index.test.ts`

  Expected: FAIL until both feature plugins use `addRoute()`.

- [ ] **Step 3: Migrate Dashboard and Settings, then document the contract**

  Replace each `addPage()` call with the exact Dashboard/Settings route definitions from the spec. Update `docs/architecture.md` to name route trees, relative paths, Router conversion, and Shell-derived navigation; remove references to page contributions.

- [ ] **Step 4: Run all checks and browser smoke test**

  Run:

  ```bash
  CI=true pnpm test
  CI=true pnpm typecheck
  CI=true pnpm build
  git diff --check
  ```

  Start the local web app and verify Dashboard, Settings, and an unknown URL renders the default 404 page. Router tests remain the verification for nested routes and error boundaries.

- [ ] **Step 5: Commit the feature migration**

  ```bash
  git add packages/feature/dashboard packages/feature/settings packages/bundle/web-app docs/architecture.md
  git commit -m "feat: migrate built-in routes to route trees"
  ```
