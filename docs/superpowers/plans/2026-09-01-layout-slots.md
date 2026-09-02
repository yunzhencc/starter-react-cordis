# Layout Slots Implementation Plan

> **For implementation:** execute each task in order. Keep the public slot surface intentionally small: two fixed shell positions and static startup contributions only.

**Goal:** Let built-in packages place static React content in the shell navigation footer and content header without introducing a generic plugin UI registry.

**Architecture:** Extend `@yunzhen/cordis-runtime` with a validated `SlotItem` collection. `AppShell` reads each known slot directly and renders it in the fixed layout. The theme package contributes one header toggle through its existing `ThemeRuntime`.

**Tech stack:** TypeScript, React 19, React Router, `@deepseek-ai/cordis`, CSS Modules, Vitest/jsdom, pnpm workspace.

**Design:** `docs/superpowers/specs/2026-09-01-layout-slots-design.md`

---

## Task 1: Add the runtime slot contribution contract

**Files:**

- Modify: `packages/core/runtime/src/runtime.ts`
- Modify: `packages/core/runtime/src/runtime.test.ts`

### Step 1: Write focused failing runtime tests

In `runtime.test.ts`, add slot fixtures with simple React components and tests that prove:

- `app.addSlotItem()` collects entries for both `shell.content.header` and `shell.navigation.footer`.
- `runtime.getSlotItems(slot)` returns only that slot's entries in ascending `order`, even if registered out of order.
- Each returned result is a new snapshot rather than the backing mutable array.
- A disposer from `addSlotItem()` removes only that contribution.
- Startup rejects duplicate `id` and duplicate `order` within one slot, plus `NaN` and `Infinity` orders.

Use existing runtime plugin test helpers and error fragments: `duplicate slot item id`, `duplicate slot item order`, and `slot item order must be finite`.

Run: `CI=true pnpm exec vitest run packages/core/runtime/src/runtime.test.ts`

Expected: the added tests fail because no slot API exists.

### Step 2: Define the minimal public contract

In `runtime.ts`, beside the route/settings definitions, add:

```ts
export type AppSlot = 'shell.navigation.footer' | 'shell.content.header'

export interface SlotItem {
  id: string
  slot: AppSlot
  order: number
  Component: ComponentType
}
```

Extend `AppContext` with `addSlotItem: (item: SlotItem) => () => void`, and `AppRuntime` with `getSlotItems: (slot: AppSlot) => readonly SlotItem[]`.

Reuse the runtime's array-plus-disposer contribution pattern. Do not add a `Slot` class, Cordis service, free-form names, or generic registry component.

### Step 3: Collect, validate, and expose entries

Within `createAppRuntime`:

- keep `slotItems: SlotItem[]` beside routes/settings;
- append in `addSlotItem`, returning a disposer that removes that exact registration;
- call `validateSlotItems(slotItems)` after plugins launch, beside route validation;
- implement `getSlotItems(slot)` with `slotItems.filter(item => item.slot === slot).sort((a, b) => a.order - b.order)` so consumers get a sorted copy.

Implement `validateSlotItems` with per-slot uniqueness sets for `id` and `order`, and require `Number.isFinite(item.order)`. Same IDs or orders in different slots stay valid.

### Step 4: Verify and commit

Run:

```bash
CI=true pnpm exec vitest run packages/core/runtime/src/runtime.test.ts
CI=true pnpm typecheck
```

Commit:

```bash
git add packages/core/runtime/src/runtime.ts packages/core/runtime/src/runtime.test.ts
git commit -m "feat: add layout slot contributions"
```

## Task 2: Render the two fixed slot positions in the shell

**Files:**

- Modify: `packages/ui/shell/src/index.tsx`
- Modify: `packages/ui/shell/src/index.module.css`
- Modify: `packages/ui/shell/src/index.test.tsx`

### Step 1: Write failing shell behavior tests

Update the shell runtime stub to provide `getSlotItems`. Add a render test with header and footer components, then assert:

- the header is in `main` before the outlet route content;
- the footer is in navigation after route links;
- an empty header slot does not create a semantic `header`;
- existing Dashboard/Settings active-navigation assertions still pass.

Use local components with `data-testid` and retain the existing memory-router and `RuntimeProvider` setup.

Run: `CI=true pnpm exec vitest run packages/ui/shell/src/index.test.tsx`

Expected: placement assertions fail before shell reads slots.

### Step 2: Render direct known-slot contributions

In `index.tsx`, read:

```ts
const navigationFooterItems = runtime.getSlotItems('shell.navigation.footer')
const contentHeaderItems = runtime.getSlotItems('shell.content.header')
```

Keep the current route `NavLink` mapping, placed inside `navigationLinks`. Render `navigationFooter` only when footer items exist, with `<Component key={id} />` entries. Before `<Outlet />`, render a conditional `<header className={styles.contentHeader}>` containing header components.

Do not introduce a reusable `<Slot>` component: the two positions are fixed and direct rendering is easier to trace.

### Step 3: Adjust only necessary CSS

Make `.navigation` a column flex container. Move its existing grid/gap behavior to `.navigationLinks`, then give `.navigationFooter` `margin-top: auto`. Make `.main` stack its optional header and outlet with a small gap. Add only `navigationLinks`, `navigationFooter`, and `contentHeader` styles.

### Step 4: Verify and commit

Run:

```bash
CI=true pnpm exec vitest run packages/ui/shell/src/index.test.tsx
CI=true pnpm typecheck
```

Commit:

```bash
git add packages/ui/shell/src/index.tsx packages/ui/shell/src/index.module.css packages/ui/shell/src/index.test.tsx
git commit -m "feat: render layout slots in shell"
```

## Task 3: Contribute the theme toggle and verify the bundle

**Files:**

- Create: `packages/ui/theme/src/theme-toggle.tsx`
- Create: `packages/ui/theme/src/theme-toggle.test.tsx`
- Modify: `packages/ui/theme/src/index.ts`
- Modify: `packages/ui/theme/src/index.test.ts`
- Modify: `packages/bundle/web-app/src/index.test.ts`
- Modify: `docs/architecture.md`

### Step 1: Write failing theme tests

In the theme plugin test, assert the runtime has exactly one `shell.content.header` entry: `{ id: 'theme-toggle', order: 100 }`. In `theme-toggle.test.tsx`, mount the real component with `ThemeRuntime`, stub `matchMedia` as existing theme tests do, click it, and assert runtime preference, document dataset theme, and local storage all switch to the opposite resolved theme.

Run:

```bash
CI=true pnpm exec vitest run packages/ui/theme/src/index.test.ts packages/ui/theme/src/theme-toggle.test.tsx
```

Expected: tests fail before component and registration exist.

### Step 2: Implement one small native toggle

Create `theme-toggle.tsx` using the existing `useSyncExternalStore` pattern from the appearance settings item. It accepts `ThemeRuntime`, derives its resolved theme, renders a native `type="button"`, and calls:

```ts
theme.setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
```

Use a destination label such as `Switch to dark theme`. The first click deliberately converts a system preference to the explicit opposite choice. Reuse `ThemeRuntime` rather than duplicating persistence or media-query logic.

### Step 3: Register the static header contribution

In `uiThemePlugin` in `index.ts`, after providing the theme service, register:

```tsx
const removeThemeToggle = app.addSlotItem({
  id: 'theme-toggle',
  slot: 'shell.content.header',
  order: 100,
  Component: () => <ThemeToggle theme={theme} />,
})
```

Call `removeThemeToggle()` in plugin cleanup with the existing service/style removers.

### Step 4: Cover the assembled app and document it

In `packages/bundle/web-app/src/index.test.ts`, assert the real built-in runtime exposes the `theme-toggle` header contribution while retaining route/settings/theme checks.

Update `docs/architecture.md` to state that core owns route, settings, and static slot contributions; Shell renders `shell.content.header` and `shell.navigation.footer`; the theme package contributes its header toggle; nested/dynamic slot composition is not first-version scope.

### Step 5: Full verification, review, and commit

Run:

```bash
CI=true pnpm test
CI=true pnpm typecheck
CI=true pnpm build
git diff --check
rg -n "TODO|FIXME|TBD" packages/core/runtime packages/ui/shell packages/ui/theme packages/bundle/web-app docs/architecture.md
```

Run the web app and smoke-test Dashboard, theme toggle, Settings, and the existing unknown-route error page.

Commit:

```bash
git add packages/ui/theme/src/theme-toggle.tsx packages/ui/theme/src/theme-toggle.test.tsx packages/ui/theme/src/index.ts packages/ui/theme/src/index.test.ts packages/bundle/web-app/src/index.test.ts docs/architecture.md
git commit -m "feat: add theme layout slot"
```

## Final verification checklist

- Runtime rejects invalid contracts and returns sorted disposable snapshots.
- Shell places header before route content and footer beneath route links; empty slots add no wrapper.
- Theme toggle is a static slot contribution and uses existing runtime persistence.
- Tests, typecheck, build, diff check, and browser smoke pass.
