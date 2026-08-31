# React Cordis Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable pnpm monorepo React template where two built-in feature plugins contribute pages through a Cordis-backed runtime.

**Architecture:** `core/runtime` owns the only direct dependency on `@deepseek-ai/cordis` and exposes an `AppPlugin` facade with one `addPage()` contribution. The static `bundle/web-app` applies `dashboard` and `settings`; React Router turns the registered pages into routes and `ui/shell` turns the same pages into navigation.

**Tech Stack:** pnpm workspaces, TypeScript, Vite, React, React Router, Vitest, `@deepseek-ai/cordis`.

**Spec:** `docs/architecture.md`

## Global Constraints

- Use a monorepo with `apps/*` and `packages/*/*` workspace globs.
- Load only trusted workspace feature packages included at build time.
- `packages/core/runtime` is the sole direct user of `@deepseek-ai/cordis`.
- Use React Router with a single `createBrowserRouter()` call after plugins have registered pages.
- Keep `dashboard` and `settings` as the only first-version feature plugins.
- Do not add third-party plugin installation, remote imports, runtime package loading, authentication, permissions, or custom HMR.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `package.json` | Root workspace scripts and development tooling |
| `pnpm-workspace.yaml` | Workspace package globs |
| `tsconfig.json` | Shared TypeScript compiler options and workspace package paths |
| `packages/core/runtime/src/runtime.ts` | Cordis lifecycle wrapper and page registry |
| `packages/core/runtime/src/runtime.test.ts` | Runtime page-registration regression test |
| `packages/bundle/web-app/src/index.test.ts` | Built-in feature-bundle regression test |
| `packages/*/*/src/index.ts` | Public package entry points |
| `packages/feature/*/src/index.tsx` | Feature plugin and page component |
| `packages/bundle/web-app/src/index.ts` | Static feature-plugin list |
| `packages/react/bridge/src/index.tsx` | React context for the created runtime |
| `packages/router/react-router/src/index.tsx` | React Router creation from registered pages |
| `packages/ui/shell/src/index.tsx` | Persistent navigation and nested route outlet |
| `apps/web/src/main.tsx` | Browser bootstrap and provider composition |
| `apps/web/src/styles.css` | Minimal readable application layout |
| `apps/web/vite.config.ts` | Vite React configuration |

### Task 1: Create the workspace toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: package manifests for every package listed in the file structure

**Interfaces:**
- Produces: workspace package names `@yunzhen/cordis-{runtime,react-bridge,react-router,ui-shell,feature-dashboard,feature-settings,bundle-web-app}`.
- Produces: root commands `pnpm dev`, `pnpm build`, `pnpm test`, and `pnpm typecheck`.

- [ ] **Step 1: Create root workspace metadata and scripts**

Use this root `package.json` shape; retain exact scripts so later tasks use one verification entry point.

```json
{
  "name": "@yunzhen/cordis-starter-react",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "build": "pnpm --filter @yunzhen/cordis-web build",
    "dev": "pnpm --filter @yunzhen/cordis-web dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create workspace discovery and TypeScript package paths**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*/*
```

Create a root `tsconfig.json` with strict mode, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, and `paths` mapping each package name to its `src/index.ts` or `src/index.tsx` entry point. Include `apps/**/*.ts`, `apps/**/*.tsx`, `packages/**/*.ts`, and `packages/**/*.tsx`.

- [ ] **Step 3: Create package manifests with only direct dependencies**

Use `"type": "module"` and an `exports` entry pointing to `./src/index.ts` (or `.tsx`) for every package. Set dependencies as follows:

```text
@yunzhen/cordis-runtime: @deepseek-ai/cordis, react
@yunzhen/cordis-react-bridge: @yunzhen/cordis-runtime, react
@yunzhen/cordis-react-router: @yunzhen/cordis-runtime, @yunzhen/cordis-ui-shell, react, react-router-dom
@yunzhen/cordis-ui-shell: @yunzhen/cordis-react-bridge, react, react-router-dom
@yunzhen/cordis-feature-dashboard: @yunzhen/cordis-runtime, react
@yunzhen/cordis-feature-settings: @yunzhen/cordis-runtime, react
@yunzhen/cordis-bundle-web-app: @yunzhen/cordis-runtime, @yunzhen/cordis-feature-dashboard, @yunzhen/cordis-feature-settings
@yunzhen/cordis-web: @yunzhen/cordis-bundle-web-app, @yunzhen/cordis-react-bridge, @yunzhen/cordis-react-router, @yunzhen/cordis-runtime, react, react-dom, react-router-dom
```

- [ ] **Step 4: Add the Vite host files**

Create `apps/web/index.html` with `<div id="root"></div>` and module script `/src/main.tsx`. Create `apps/web/vite.config.ts` using `defineConfig({ plugins: [react()] })`.

- [ ] **Step 5: Install and verify the empty toolchain**

Run: `pnpm install`

Run: `pnpm exec tsc --version`

Expected: prints the installed TypeScript version. The first type check happens in Task 2, after there is TypeScript source to check.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.json apps/web/package.json apps/web/index.html apps/web/vite.config.ts packages
git commit -m "chore: initialize React Cordis workspace"
```

### Task 2: Implement and test the minimal Cordis runtime

**Files:**
- Create: `packages/core/runtime/src/runtime.ts`
- Create: `packages/core/runtime/src/index.ts`
- Create: `packages/core/runtime/src/runtime.test.ts`

**Interfaces:**
- Produces: `Page`, `AppPlugin`, `AppRuntime`, and `createAppRuntime(plugins)` from `@yunzhen/cordis-runtime`.
- Consumes: no application package; this package alone imports `@deepseek-ai/cordis`.

- [ ] **Step 1: Write the failing runtime test**

```ts
import { describe, expect, it } from 'vitest'
import { createAppRuntime, type AppPlugin } from './runtime'

describe('createAppRuntime', () => {
  it('keeps pages contributed by plugins in registration order', async () => {
    const first: AppPlugin = (app) => app.addPage({ id: 'home', path: '/', label: 'Home', Component: () => null })
    const second: AppPlugin = (app) => app.addPage({ id: 'settings', path: '/settings', label: 'Settings', Component: () => null })

    const runtime = await createAppRuntime([first, second])

    expect(runtime.pages.map((page) => page.id)).toEqual(['home', 'settings'])
    await runtime.dispose()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/core/runtime/src/runtime.test.ts`

Expected: FAIL because `./runtime` does not exist.

- [ ] **Step 3: Implement the smallest runtime facade**

Implement the following public shapes in `runtime.ts`:

```ts
import type { ComponentType } from 'react'

export interface Page {
  id: string
  path: string
  label: string
  Component: ComponentType
}

export interface AppContext {
  addPage(page: Page): () => void
}

export type AppPlugin = (app: AppContext) => void | (() => void)

export interface AppRuntime {
  readonly pages: readonly Page[]
  dispose(): Promise<void>
}

export function createAppRuntime(plugins: readonly AppPlugin[]): Promise<AppRuntime>
```

Inside `createAppRuntime`, create a Cordis context, expose a closure-backed `addPage`, and invoke each plugin through the Cordis lifecycle (`cordis.plugin(() => plugin(app))`). Await every returned Fiber before returning the runtime: Cordis starts plugin bodies on a microtask, so the page list is not ready synchronously. `addPage` returns a disposer that removes its exact page; let the Cordis Fiber invoke it during unload. Return an immutable view of the page array and make `dispose()` await disposal of every created Fiber. Do not add a generic event bus, arbitrary service registry, or dynamic refresh API.

- [ ] **Step 4: Export and verify the runtime**

Make `src/index.ts` re-export `./runtime`. Run:

```bash
pnpm exec vitest run packages/core/runtime/src/runtime.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/runtime
git commit -m "feat: add Cordis page runtime"
```

### Task 3: Add the static feature bundle and two feature plugins

**Files:**
- Create: `packages/feature/dashboard/src/index.tsx`
- Create: `packages/feature/settings/src/index.tsx`
- Create: `packages/bundle/web-app/src/index.ts`
- Create: `packages/bundle/web-app/src/index.test.ts`

**Interfaces:**
- Consumes: `AppPlugin` from `@yunzhen/cordis-runtime`.
- Produces: `webAppPlugins: readonly AppPlugin[]` from `@yunzhen/cordis-bundle-web-app`.

- [ ] **Step 1: Write the failing feature-bundle assertion**

Create `packages/bundle/web-app/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app'
import { createAppRuntime } from '@yunzhen/cordis-runtime'

describe('webAppPlugins', () => {
  it('loads the built-in dashboard and settings pages', async () => {
    const runtime = await createAppRuntime(webAppPlugins)

    expect(runtime.pages.map(({ id, path }) => [id, path])).toEqual([
      ['dashboard', '/'],
      ['settings', '/settings'],
    ])
    await runtime.dispose()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/bundle/web-app/src/index.test.ts`

Expected: FAIL because `@yunzhen/cordis-bundle-web-app` has no source entry.

- [ ] **Step 3: Implement the two feature plugins**

Each feature file exports a page component and one plugin. Use this exact contribution shape:

```ts
export const dashboardPlugin: AppPlugin = (app) => {
  return app.addPage({
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    Component: DashboardPage,
  })
}
```

`DashboardPage` renders an `h1` with `Dashboard`. `SettingsPage` follows the same structure with `id: 'settings'`, `path: '/settings'`, label `Settings`, and an `h1` with `Settings`.

- [ ] **Step 4: Implement static composition**

```ts
import { dashboardPlugin } from '@yunzhen/cordis-feature-dashboard'
import { settingsPlugin } from '@yunzhen/cordis-feature-settings'
import type { AppPlugin } from '@yunzhen/cordis-runtime'

export const webAppPlugins: readonly AppPlugin[] = [dashboardPlugin, settingsPlugin]
```

There must be no `import()`, npm installation call, profile file, or remote URL in this package.

- [ ] **Step 5: Run the focused test and type check**

Run:

```bash
pnpm exec vitest run packages/bundle/web-app/src/index.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/feature packages/bundle
git commit -m "feat: add built-in feature plugins"
```

### Task 4: Connect the runtime to React Router and the application shell

**Files:**
- Create: `packages/react/bridge/src/index.tsx`
- Create: `packages/router/react-router/src/index.tsx`
- Create: `packages/ui/shell/src/index.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `AppRuntime` and `Page` from `@yunzhen/cordis-runtime`.
- Consumes: `webAppPlugins` from `@yunzhen/cordis-bundle-web-app`.
- Produces: a browser application with `/` and `/settings` routes inside one persistent shell.

- [ ] **Step 1: Write the failing router test**

Create `packages/router/react-router/src/index.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { createAppRuntime, type AppPlugin } from '@yunzhen/cordis-runtime'
import { createAppRouter } from './index'

describe('createAppRouter', () => {
  it('creates routes for every registered page', async () => {
    const plugin: AppPlugin = (app) => app.addPage({ id: 'home', path: '/', label: 'Home', Component: () => null })
    const runtime = await createAppRuntime([plugin])

    expect(createAppRouter(runtime).routes[0].children).toHaveLength(1)
    await runtime.dispose()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/router/react-router/src/index.test.tsx`

Expected: FAIL because `createAppRouter` does not exist.

- [ ] **Step 3: Implement the React bridge**

Export `RuntimeProvider` and `useRuntime` from `@yunzhen/cordis-react-bridge`. `RuntimeProvider` accepts `{ runtime: AppRuntime; children: ReactNode }`; `useRuntime` reads the context and throws `Error('App runtime is unavailable')` when used outside the provider.

- [ ] **Step 4: Implement router creation and shell layout**

Export this function from `@yunzhen/cordis-react-router`:

```ts
export function createAppRouter(runtime: AppRuntime): ReturnType<typeof createBrowserRouter>
```

It creates exactly one root route with `Component: AppShell` and one child route per `runtime.pages`; each child route uses its page `path` and `Component`.

`AppShell` renders a `<nav>` containing one `NavLink` per `useRuntime().pages`, and an `<main><Outlet /></main>`. Use page `id` as each link key, `path` as `to`, and `label` as visible text.

- [ ] **Step 5: Implement browser bootstrap and styling**

In `apps/web/src/main.tsx`, create an async `bootstrap()` function. It awaits one runtime from `webAppPlugins`, creates one router from that ready runtime, and renders:

```tsx
async function bootstrap() {
  const runtime = await createAppRuntime(webAppPlugins)
  const router = createAppRouter(runtime)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RuntimeProvider runtime={runtime}>
        <RouterProvider router={router} />
      </RuntimeProvider>
    </StrictMode>,
  )
}

void bootstrap()
```

Add only the CSS needed for a horizontal full-height layout, a fixed-width navigation column, content padding, and an active navigation link. Do not add a component library or theme system.

- [ ] **Step 6: Run router test, full test suite, type check, and production build**

Run:

```bash
pnpm exec vitest run packages/router/react-router/src/index.test.tsx
pnpm test
pnpm typecheck
pnpm build
```

Expected: all PASS.

- [ ] **Step 7: Smoke-test the two browser routes**

Run: `pnpm dev`

Open the local Vite URL. Verify that `/` displays `Dashboard`, `/settings` displays `Settings`, and each navigation link switches route without a full page reload.

- [ ] **Step 8: Commit**

```bash
git add packages/react packages/router packages/ui apps/web
git commit -m "feat: render built-in plugin pages"
```

## Self-review

- Spec coverage: Tasks 1–4 cover the monorepo layout, Cordis-only runtime boundary, static trusted composition, one-time React Router creation, persistent shell, and the `dashboard` and `settings` example plugins. Dynamic third-party loading, authentication, permissions, and custom HMR are explicitly excluded.
- Placeholder scan: no task contains an unfinished-work marker or a reference to an undefined later implementation.
- Type consistency: `Page`, `AppPlugin`, `AppRuntime`, `createAppRuntime`, and `webAppPlugins` are defined in Task 2 or Task 3 and used under those names in later tasks.
