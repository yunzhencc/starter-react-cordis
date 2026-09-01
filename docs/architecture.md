# starter-react-cordis 首版架构

## 状态与范围

当前生效的架构规格是 [DeepSeek 对齐的插件运行时设计](superpowers/specs/2026-09-01-deepseek-aligned-plugin-runtime-design.md)。首版只启动随仓库构建发布的静态模块；不提供第三方安装、远程模块、Node/CDN Provider、懒 CJS、HMR 或运行时插件装卸。

## 静态启动链

```text
apps/web
  └─ 创建 Cordis Context
      └─ bundle/web-app 的固定模块顺序
          renderer → router → layout → theme → dashboard → settings
              └─ ctx.uiRenderer.mount(container)
```

`apps/web` 直接创建 Context 并逐个安装 `webAppPlugins`。模块的 `inject` 声明所需 Service；依赖父 Route 或 Slot 的贡献使用 `ctx.routes.inject()` / `ctx.slots.inject()` 等待声明，而不是依赖同级模块的加载时序。

## 包职责

| 包 | 职责 |
| --- | --- |
| `@yunzhen/cordis-client-modules` | 仅导出未来动态模块的 `WebBootGraph` 与 `PluginCatalogProvider` 协议类型；首版没有 Provider 或运行时代码。 |
| `@yunzhen/cordis-ui-slots` | 纯 `SlotMap` / `SlotCore`，支持 `root`、`single`、`list` 与唯一 `root` scope。 |
| `@yunzhen/cordis-ui-renderer` | `ctx.slots` 的 SlotRegistry Service，以及 `ctx.uiRenderer` 的唯一 React 根挂载。 |
| `@yunzhen/cordis-ui-router` | `ctx.routes` 的 RouteRegistry、React Router 适配和 Route 的 Slot owner。 |
| `@yunzhen/cordis-ui-layout` | `ctx.layout` 面板动作和无路径 `app-layout` 三栏 Route。 |
| `feature/dashboard`、`feature/settings`、`ui/theme` | 通过 Cordis `inject` + `apply` 注册 Route 或 Slot 贡献。 |
| `bundle/web-app` | 静态导入并固定组合上述内置模块。 |

旧的 `core/runtime`、`react/bridge`、`router/react-router` 与 `ui/shell` 分层已不属于当前实现。

## Slot、Route 与布局

Slots 只有 `root` scope。父项的 `children` 是子 Slot 唯一声明授权；父项移除会递归清理后代声明和贡献，过期 disposer 为无操作。根 renderer 只渲染 `root` Slot，Route 通过 Router 内部的 Slot owner 声明并渲染自己的子 Slots。

Router 是唯一向 `root` Slot 注册的路由宿主。`ctx.routes` 以 `id`、`parentId`、可选 `path` / `index`、`Component` 与页面 `children` Slots 描述路由；`path` 缺省表示不消费 URL 的 Layout Route。跨模块以 `parentId` 建立父子关系，不能修改彼此的 `children` 数组。

`ui-layout` 注册无路径 `app-layout`，并声明：

```text
app-layout
├─ sidebar (single)
│  ├─ sidebar.navigation (list)
│  └─ sidebar.footer (list)
├─ main (single；Router 的 Outlet 占据)
├─ workbench (single)
└─ shell.overlay (list)
```

Dashboard 和 Settings 都是 `app-layout` 的子 Route；主题插件向 Settings 的 `settings.section` list Slot 提供 Appearance 区块。`ctx.layout` 仅管理侧栏与工作台开关；不持久化尺寸、不支持拖拽或响应式自动折叠。

## 未来动态模块协议

`WebBootGraph` 和 `PluginCatalogProvider` 只固定将来 Provider 的数据契约。未来可由 Node、HTTP 或 CDN 提供同一 graph；实际 Loader、Fiber 生命周期与 HMR 仍需单独实现，不能把当前的静态 boot 误认为动态模块运行时。
