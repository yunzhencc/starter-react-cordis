# DeepSeek 对齐的插件运行时设计

## 状态与范围

本规格取代仓库中以 `AppPlugin`、`AppContext`、`AppRuntime` 为中心的静态贡献模型，以及此前只覆盖固定 Shell 的 Slot / Route 设计。目标是让 `starter-react-cordis` 的插件 API、Service 归属和 Slot 生命周期尽量与 DeepSeek Harness 对齐，同时保留 React Router 的 URL 路由能力。

本次实现首版静态内核：插件 API、Service、Slots、嵌套路由、无路径 Layout Route 和 `dashboard` / `settings` 示例。它只固定未来动态加载所需的协议类型，不实现 Node/CDN Provider、浏览器懒 CJS、HMR 或第三方包安装。

## DeepSeek 对齐原则

插件以 Cordis 对象模块形式编写：

```ts
export const inject = ['slots', 'routes']

export function apply(ctx: Context): void {
  ctx.routes.inject('app-layout', () => ctx.routes.register({ /* ... */ }))
}
```

不再暴露自定义 `AppPlugin` 函数或要求业务代码返回 disposer。插件资源必须由 `ctx.effect()` 管理。Service 的注册方法必须是原型方法，借由 Cordis Service proxy 取得调用者 Context；因此 `register()`、`inject()` 的 effect 和清理归属调用插件 Fiber，而不是 Service 自己的根 Context。

以下是有意差异：Harness 没有 URL Router；本项目在同一 Service / Fiber / Slot 机制上增加 `ctx.routes`。Route 不是 Slot Core 的新 kind；它是 Router 领域对象，可声明自己页面内的 Slot。

## 包边界

```text
@yunzhen/cordis-client-modules
  WebBootGraph 与 PluginCatalogProvider 的协议类型；首版无运行时代码。

@yunzhen/cordis-ui-slots
  纯 SlotMap、SlotCore、root / single / list 声明与级联清理。

@yunzhen/cordis-ui-renderer
  SlotRegistry Service（ctx.slots）与 React 根挂载（ctx.uiRenderer）。

@yunzhen/cordis-ui-router
  RouteRegistry Service（ctx.routes）、React Router 适配、RouteSlotOwner。

@yunzhen/cordis-ui-layout
  LayoutController（ctx.layout）与 app-layout Route 的三栏界面。

feature/dashboard、feature/settings、ui/theme
  仅通过 inject + apply 注册 Route 或 Slot 贡献。
```

现有 `core/runtime` 与 `react/bridge` 删除；`ui/shell` 更名为 `ui/layout`。`apps/web` 直接创建 Cordis `Context`、安装静态模块集合，并调用 `ctx.uiRenderer.mount(container)`。

## Slot 与 Renderer

`ui-slots` 只实现 Harness 的最小核心子集：内建 `root`、`single`、`list` 和 `root` scope。父项的 `children` 是唯一的子 Slot 声明授权；移除父项会递归移除全部后代声明与贡献。过期 disposer 是无操作，之后由新父项可重新声明相同名称。

`ui-renderer` 创建 `SlotRegistry extends Service` 并安装 React Slot renderer。它提供：

- `ctx.slots.register()`：通过调用者 `ctx.effect()` 注册；
- `ctx.slots.inject()`：在目标声明出现时运行，在声明 epoch 更换时先清理再重新运行；
- `ctx.uiRenderer.mount(container)`：挂载唯一 React 根。

`inject()` 的回调若初次或后续重建失败，遵循 Harness 语义：停止该 injection、清理已激活部分并抛出错误；不在下一次声明出现时自动重试。

首版不实现 `session`、`session-maybe`、`keyed`、`chain`、store factory 或跨 session 状态。它们不是占位 API；需要时按 Harness 的对应模型单独增加。

## Route 与 Layout

`RouteRegistry extends Service` 提供：

```ts
ctx.routes.register({ id, parentId?, path?, index?, Component, children? })
ctx.routes.inject(parentId, callback)
ctx.routes.snapshot()
ctx.routes.subscribe(listener)
```

`parentId` 建立嵌套关系，避免让不同插件修改同一 `children` 数组。`children` 保留给该 Route 页面声明 Slot；`path` 可省略，表示不消费 URL 片段的 Layout Route；`index` 与 `path` 互斥。Route 注册与等待行为跟随调用插件 Fiber，且不依赖同级插件加载顺序。

`ui-router` 是唯一注册到 `root` Slot 的路由宿主。它生成 React Router 路由树，并通过内部 `RouteSlotOwner` 让匹配 Route 成为其 `children` Slot 的唯一渲染者。这个桥接只存在于 Router 包，不污染 SlotCore。

`ui-layout` 注册无路径 `app-layout` Route，并提供三栏：`sidebar | main | workbench`。`AppLayout` 渲染 `main` Slot；`ui-router` 向这个 single Slot 注册内部 `RouteOutlet`，由它调用原生 `<Outlet />` 承担父 Route 的子页面渲染。布局 Slot 树为：

```text
app-layout
├─ sidebar (single)
│  ├─ sidebar.navigation (list)
│  └─ sidebar.footer (list)
├─ main (single；由 ui-router 的 Outlet 贡献占据)
├─ workbench (single)
└─ shell.overlay (list)
```

`ctx.layout` 是 app-layout 的面板动作服务：`toggleSidebar()`、`openWorkbench()`、`closeWorkbench()`、`toggleWorkbench()`。首版状态只有 `{ sidebarOpen, workbenchOpen }`；两侧完全隐藏时由 main 填满空间。无 workbench 贡献时右栏隐藏。不持久化宽度、不支持拖拽或响应式自动折叠。

Dashboard 与 Settings 均作为 `app-layout` 的子 Route。Settings Route 声明 `settings.section` list Slot；主题插件向该 Slot 贡献 Appearance 区块，替换当前全局 `settingsItems` 收集器。

## 静态启动与失败语义

首版入口只组合仓库内静态模块。Renderer 是基础模块；其余插件通过 `inject` 声明所需 Service，且通过 `slots.inject()` / `routes.inject()` 等待父声明。启动代码不实现自定义插件事务、全局回滚或自动重试；Cordis Fiber 的 FAILED / dispose 语义是唯一真相。

Slot 或 Route 的非法注册（未声明 Slot、重复声明、重复 Route id、循环父子关系、非法 path/index）使对应插件 Fiber 安装失败，并携带插件与目标的诊断。Route 是新增领域能力，其冲突校验应遵循 Slot 的“显式失败，不静默覆盖”原则。

页面 URL 切换只装卸 React Route 树；已启用插件 Fiber、Route 声明和 Slot 声明仍然存在。只有 Fiber dispose 才会清理 Service、Route、Slot 与 effect。

## 未来动态模块协议（仅固定类型）

未来包在 `package.json` 中使用自有元数据，避免冒充上游 Cordis 标准：

```json
{
  "yunzhen": {
    "client": {
      "platform": "web",
      "inject": [],
      "external": [],
      "immediately": false
    }
  }
}
```

`@yunzhen/cordis-client-modules` 定义与 Harness `WebBootGraph` 等价的协议：

```ts
interface WebBootGraph {
  revision: string
  entries: Array<{
    id: string
    url: string
    rev: string
    inject?: string[]
    immediately?: boolean
    external?: string[]
  }>
}

interface PluginCatalogProvider {
  id: string
  snapshot(): Promise<WebBootGraph>
  watch?(onChange: () => void): () => void
}
```

抽象点位于 Harness `window.__DSH_BOOT__` 之前：Node Provider 可以扫描 Cordis Loader 中的启用条目并生成图；HTTP Provider 可从任意服务读取图；CDN 仅存储和分发同格式 graph 与 bundle。Snapshot 之后仍采用 Harness 形态的懒 CJS Module System、Cordis Loader / EntryTree、Fiber 生命周期与 HMR 驱动，不把原生 ESM `import(entry)` 固化为替代模型。

未来 HMR 采用 Harness 的无回滚语义：先 invalidate 并预取新 factory；预取失败时旧 Fiber 继续运行；预取成功才卸载旧 Fiber、移除旧样式并 materialize 新 factory；新 apply 失败时 entry 无 Fiber，等待下一 revision 重试。

## 验证

- `ui-slots`：root、未声明/冲突报错、声明所有权、递归级联、过期 disposer。
- `ui-renderer`：调用方 Fiber 清理、`inject()` epoch 重挂载与失败停止、root renderer 安装约束。
- `ui-router`：无路径 Layout、`parentId` 等待、Route 卸载、RouteSlotOwner、重复 id / 循环 / path-index 校验。
- `ui-layout`：三栏完全折叠、无 workbench 时隐藏、Outlet 在 main Slot。
- 功能冒烟：Dashboard、Settings、Appearance Slot 与主题偏好保持可用。
- `client-modules`：协议类型和 manifest 字段检查；不添加 Provider / Loader 行为测试。
- 执行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
