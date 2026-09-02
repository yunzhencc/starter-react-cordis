# Extensible Settings Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a route-owned settings shell that replaces the application sidebar and lets independent plugins contribute grouped settings pages through one registry call.

**Architecture:** Add optional route sidebar chrome to the router. `@yunzhen/cordis-ui-settings-layout` owns `/settings`, its sidebar, footer entry, and `ctx.settings`; each settings extension owns an entry. Theme remains a foundation package and Appearance moves to its own settings extension.

**Tech Stack:** TypeScript, React 19, React Router 7, Cordis 4, CSS Modules, Lucide React, Vitest/jsdom, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-02-settings-layout-design.md`

## Global Constraints

- Reuse `app-layout` and its existing responsive/sidebar state; do not create a second layout state machine.
- `ui-settings-layout` does not import theme or any settings domain package.
- `ui-theme` does not register settings menu items, routes, or pages.
- One `ctx.settings.register()` call owns its menu item and child route together.
- Use Lucide `Settings` in the default footer entry; every importing package declares `lucide-react` directly.
- Do not add settings search, remote persistence, runtime installation, or generic form controls.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/ui/router/src/routes.ts` | Optional `Sidebar` route metadata and immutable snapshot copying. |
| `packages/ui/router/src/index.tsx` | Deepest-matched sidebar selection with existing navigation fallback. |
| `packages/ui/settings-layout/src/registry.ts` | Settings-entry validation, sorting, route injection, and lifecycle cleanup. |
| `packages/ui/settings-layout/src/index.tsx` | `/settings` parent route, sidebar, footer button, redirect, and Outlet. |
| `packages/feature/settings-appearance/src/*` | Appearance page and its settings registration. |
| `packages/ui/theme/src/index.ts` | Theme service and style lifecycle only. |

### Task 1: Add route-level sidebar chrome

**Files:**
- Modify: `packages/ui/router/src/routes.ts`
- Modify: `packages/ui/router/src/routes.test.ts`
- Modify: `packages/ui/router/src/index.tsx`
- Modify: `packages/ui/router/src/index.test.tsx`

**Interfaces:**
- Produces `RouteDefinition.Sidebar?: ComponentType`.
- Produces internal `findMatchedSidebar(routes, pathname)` for the router host.

- [ ] **Step 1: Write the failing sidebar replacement test**

In `packages/ui/router/src/index.test.tsx`, register a `settings` route with a custom `Sidebar` and a child page:

```tsx
const SettingsSidebar = () => <nav data-settings-sidebar><a href="/">Return to app</a></nav>
ctx.routes.register({
  id: 'settings', parentId: 'app-layout', path: 'settings',
  Component: Outlet, Sidebar: SettingsSidebar,
})
ctx.routes.register({
  id: 'settings.appearance', parentId: 'settings', path: 'appearance',
  Component: () => <h1>Appearance</h1>,
})
```

Mount `/settings/appearance`; assert `[data-settings-sidebar]` is present and the Dashboard link is absent. Navigate to `/`; assert the default Dashboard navigation returns.

- [ ] **Step 2: Verify the test fails**

Run: `CI=true pnpm exec vitest run packages/ui/router/src/index.test.tsx`

Expected: FAIL because `Sidebar` is not part of the route contract and the default navigation always renders.

- [ ] **Step 3: Add and preserve the metadata**

In `routes.ts`, add `Sidebar?: ComponentType` to `RouteDefinition`. Keep it in `RouteSnapshot` by leaving it outside the existing `Omit` list. In `routes.test.ts`, register a sidebar component and assert that the frozen snapshot preserves that component reference.

- [ ] **Step 4: Render the deepest matching sidebar**

In `index.tsx`, use `useLocation` and `matchRoutes`, not `useMatches` (the app uses `BrowserRouter` plus `useRoutes`, not a data router). Build matchable objects from the current snapshot, inspect matches from deepest to shallowest, then render the first matched `Sidebar`.

```tsx
const Sidebar = findMatchedSidebar(snapshot, location.pathname)
if (Sidebar)
  return <Sidebar />
return <DefaultNavigationSidebar links={links} />
```

Keep the existing navigation and `sidebar.navigation` / `sidebar.footer` Slots inside `DefaultNavigationSidebar` unchanged.

- [ ] **Step 5: Verify and commit**

Run: `CI=true pnpm exec vitest run packages/ui/router/src/index.test.tsx packages/ui/router/src/routes.test.ts && pnpm --filter @yunzhen/cordis-ui-router exec tsc --noEmit`

Expected: PASS; settings children replace the sidebar and non-settings routes restore it.

```bash
git add packages/ui/router/src/routes.ts packages/ui/router/src/routes.test.ts packages/ui/router/src/index.tsx packages/ui/router/src/index.test.tsx
git commit -m "feat: allow route sidebars"
```

### Task 2: Add the independent settings layout package

**Files:**
- Create: `packages/ui/settings-layout/package.json`
- Create: `packages/ui/settings-layout/tsconfig.json`
- Create: `packages/ui/settings-layout/src/registry.ts`
- Create: `packages/ui/settings-layout/src/registry.test.ts`
- Create: `packages/ui/settings-layout/src/index.tsx`
- Create: `packages/ui/settings-layout/src/index.module.css`
- Create: `packages/ui/settings-layout/src/index.test.tsx`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `SettingsEntry`, `SettingsRegistry`, and `ctx.settings.register(entry)`.
- Consumes `ctx.routes.inject()`, `ctx.slots.inject()`, `Navigate`, `NavLink`, `Outlet`, and Task 1 `Sidebar`.

- [ ] **Step 1: Write failing registry tests**

Create `registry.test.ts` using a Cordis context with renderer, router, app-layout, and settings-layout. Register entries in reverse order:

```ts
ctx.settings.register({
  id: 'appearance',
  group: { id: 'personal', label: 'Personal', order: 100 },
  label: 'Appearance', order: 100, Component: Null,
})
ctx.settings.register({
  id: 'shortcuts',
  group: { id: 'coding', label: 'Coding', order: 200 },
  label: 'Keyboard shortcuts', order: 10, Component: Null,
})
```

Assert the snapshot order is Appearance then Shortcuts; routes have ids `settings.appearance` and `settings.shortcuts`; disposing the caller Fiber removes both its entry and route. Test rejection of duplicate id, `bad/path`, blank label, blank group id, inconsistent metadata for a group id, and `Infinity` order.

- [ ] **Step 2: Verify the tests fail**

Run: `CI=true pnpm exec vitest run packages/ui/settings-layout/src/registry.test.ts`

Expected: FAIL because `ctx.settings` and the package do not exist.

- [ ] **Step 3: Implement the registry contract**

Create a web-tsconfig package named `@yunzhen/cordis-ui-settings-layout`. It depends on Cordis, renderer, router, React, React Router, and `lucide-react`; its client metadata injects `@yunzhen/cordis-ui-router`.

In `registry.ts`, define:

```ts
export interface SettingsEntry {
  id: string
  group: { id: string; label: string; order: number }
  label: string
  Icon?: ComponentType<{ size?: number; strokeWidth?: number }>
  order: number
  Component: ComponentType
}

export class SettingsRegistry extends Service {
  snapshot: () => readonly SettingsEntry[]
  subscribe: (listener: () => void) => () => void
  register: (entry: SettingsEntry) => () => void
}
```

`register()` copies and validates the entry, publishes a frozen snapshot sorted by group order, item order, and id, then creates the child route through `ctx.routes.inject('settings', ...)`. The route uses id `settings.${entry.id}`, parent `settings`, path `entry.id`, and `entry.Component`. Its disposer removes both the menu entry and injected route in the caller Fiber.

- [ ] **Step 4: Implement the route, sidebar, and footer link**

In `index.tsx`, instantiate `SettingsRegistry` and inject this parent route beneath `app-layout`:

```tsx
ctx.routes.inject('app-layout', () => ctx.routes.register({
  id: 'settings', parentId: 'app-layout', path: 'settings',
  Component: SettingsLayout, Sidebar: SettingsSidebar,
}))
```

`SettingsLayout` subscribes to entries. At `/settings`, it renders `<Navigate replace to={entries[0]?.id ?? '.'} />`; with no entries it renders `No settings available.`. Otherwise it renders the current entry label and `<Outlet />` in the content column.

`SettingsSidebar` has a `/` `NavLink` labelled `Return to app`, groups entries by `group.id`, and renders `/settings/${entry.id}` links. Inject a footer entry into `sidebar.footer` with id `settings`, order `100`, and `<Settings size={18} />` plus `Settings` text. Style sidebar/menu/content with existing `--app-surface`, `--app-border`, `--app-text`, and `--app-accent` tokens; the default footer uses `margin-top: auto`.

- [ ] **Step 5: Add DOM behavior tests**

In `index.test.tsx`, mount `/settings`, register Appearance and Shortcuts, then assert:

```ts
expect(container.querySelector('[data-settings-sidebar]')).not.toBeNull()
expect(container.textContent).toContain('Return to app')
expect([...container.querySelectorAll('[data-settings-menu] a')].map(a => a.textContent))
  .toEqual(['Appearance', 'Keyboard shortcuts'])
expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Appearance')
```

From `/`, click the footer Settings link and assert Appearance renders; click Return to app and assert Dashboard navigation is restored. Add an empty-registry assertion that checks the explicit empty state rather than an invalid redirect.

- [ ] **Step 6: Verify and commit**

Run: `CI=true pnpm exec vitest run packages/ui/settings-layout/src/registry.test.ts packages/ui/settings-layout/src/index.test.tsx && pnpm --filter @yunzhen/cordis-ui-settings-layout exec tsc --noEmit`

Expected: PASS; one extension owns one menu entry and route for its Fiber lifetime.

```bash
git add packages/ui/settings-layout pnpm-lock.yaml
git commit -m "feat: add settings layout registry"
```

### Task 3: Extract Appearance into its own settings extension

**Files:**
- Create: `packages/feature/settings-appearance/package.json`
- Create: `packages/feature/settings-appearance/tsconfig.json`
- Create: `packages/feature/settings-appearance/src/index.tsx`
- Create: `packages/feature/settings-appearance/src/index.test.tsx`
- Create: `packages/feature/settings-appearance/src/appearance-settings.tsx`
- Create: `packages/feature/settings-appearance/src/appearance-settings.module.css`
- Modify: `packages/ui/theme/src/index.ts`
- Modify: `packages/ui/theme/src/index.test.ts`
- Delete: `packages/ui/theme/src/appearance-settings-item.tsx`
- Delete: `packages/ui/theme/src/appearance-settings-item.module.css`
- Delete: `packages/feature/settings/package.json`
- Delete: `packages/feature/settings/tsconfig.json`
- Delete: `packages/feature/settings/src/index.tsx`
- Delete: `packages/feature/settings/src/index.test.tsx`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes `ctx.theme` and `ctx.settings.register()`.
- Produces `@yunzhen/cordis-feature-settings-appearance` with `/settings/appearance`.

- [ ] **Step 1: Write the failing Appearance extension test**

Boot renderer, router, app-layout, settings-layout, theme, and the new extension. Assert the registry contains:

```ts
{
  id: 'appearance',
  group: { id: 'personal', label: 'Personal', order: 100 },
  label: 'Appearance',
  order: 100,
}
```

Mount `/settings/appearance`; assert the Appearance heading, system/light/dark radios, and font-size range. Dispose the extension Fiber and assert Appearance disappears from both registry and routes.

- [ ] **Step 2: Verify the test fails**

Run: `CI=true pnpm exec vitest run packages/feature/settings-appearance/src/index.test.tsx`

Expected: FAIL because no Appearance extension exists.

- [ ] **Step 3: Move UI ownership and register Appearance**

Move the current appearance component and CSS from `ui/theme` to the new feature package. Its plugin exports:

```tsx
export const inject = ['settings', 'theme']

export function apply(ctx: Context) {
  const theme = ctx.theme
  ctx.settings.register({
    id: 'appearance',
    group: { id: 'personal', label: 'Personal', order: 100 },
    label: 'Appearance', Icon: Palette, order: 100,
    Component: () => <AppearanceSettings theme={theme} />,
  })
}
```

The extension declares direct React, `lucide-react`, theme, and settings-layout dependencies; its client metadata injects both settings-layout and theme.

Remove all React, renderer, slot, and appearance imports from `ui/theme/src/index.ts`. Keep only ThemeRuntime creation, provision, style installation, and cleanup; set both runtime and catalog inject arrays to empty. Update Theme tests to assert only service/style lifecycle. Remove the old `feature/settings` package because settings-layout now owns the parent route.

- [ ] **Step 4: Verify and commit**

Run: `CI=true pnpm exec vitest run packages/ui/theme/src/index.test.ts packages/feature/settings-appearance/src/index.test.tsx && pnpm --filter @yunzhen/cordis-ui-theme exec tsc --noEmit && pnpm --filter @yunzhen/cordis-feature-settings-appearance exec tsc --noEmit`

Expected: PASS; theme is headless and Appearance alone contributes the settings page.

```bash
git add packages/ui/theme packages/feature/settings-appearance packages/feature/settings pnpm-lock.yaml
git commit -m "feat: extract appearance settings extension"
```

### Task 4: Compose and validate the application

**Files:**
- Modify: `apps/web/cordis.yml`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite-plugin.test.ts`
- Modify: `packages/ui/layout/src/index.module.css`
- Modify: `packages/ui/layout/src/index.test.tsx`
- Modify: `docs/architecture.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes Task 2 and Task 3 client metadata.
- Produces a boot graph with `settings-layout` and `settings-appearance`, without legacy `settings`.

- [ ] **Step 1: Write failing composition tests**

In `apps/web/vite-plugin.test.ts`, assert the loaded graph includes `settings-layout` and `settings-appearance`, excludes `settings`, and orders Appearance after settings-layout and theme. In `layout/src/index.test.tsx`, mount `/settings/appearance` through real app-layout and assert `[data-sidebar-column]` contains the settings sidebar with no second sidebar panel.

- [ ] **Step 2: Verify the tests fail**

Run: `CI=true pnpm exec vitest run apps/web/vite-plugin.test.ts packages/ui/layout/src/index.test.tsx`

Expected: FAIL because the catalog still declares legacy Settings.

- [ ] **Step 3: Switch application composition**

Replace the `settings` catalog row with:

```yml
- id: settings-layout
  name: '@yunzhen/cordis-ui-settings-layout'
- id: settings-appearance
  name: '@yunzhen/cordis-feature-settings-appearance'
```

Replace the old Settings workspace dependency in `apps/web/package.json`. Adjust layout CSS only enough to let its full-height sidebar child display the settings sidebar; preserve current panel widths, bounds, resize behavior, and `LayoutController`.

- [ ] **Step 4: Update architecture docs**

In `docs/architecture.md`, replace legacy `feature/settings` with settings-layout and settings extensions. Document route Sidebar replacement, `ctx.settings.register()`, headless theme, and the Appearance extension boundary.

- [ ] **Step 5: Complete verification and commit**

Run:

```bash
CI=true pnpm test
CI=true pnpm typecheck
CI=true pnpm build
git diff --check
```

Verify `apps/web/dist/cordis.boot.json` contains `settings-layout` and `settings-appearance`, not `settings`. Run `pnpm dev` and manually check Dashboard sidebar/workbench, footer gear navigation, Settings sidebar replacement, Appearance controls, Return to app, and persisted theme/font size.

```bash
git add apps/web packages/ui/layout/src/index.module.css packages/ui/layout/src/index.test.tsx docs/architecture.md pnpm-lock.yaml
git commit -m "feat: compose extensible settings layout"
```
