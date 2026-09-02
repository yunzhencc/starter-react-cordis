# starter-react-cordis 首版架构

## 状态与范围

当前生效的架构规格是 [静态插件启动设计](superpowers/specs/2026-09-01-deepseek-aligned-static-plugin-boot-design.md)。生产只发布静态 `dist`；不提供生产 Node 服务、HMR、第三方安装、远程模块、运行时插件装卸或 YAML `!!js` 配置。

## 静态启动链

```text
apps/web/cordis.yml
  └─ host/plugin-catalog 读取包元数据
      └─ WebBootGraph
          └─ Vite 虚拟 registry（开发）/ cordis.boot.json + chunks（构建）
              └─ client/modules Boot Loader
                  └─ Cordis Context → ctx.uiRenderer.mount(container)
```

`apps/web/cordis.yml` 是该应用唯一的启用来源。catalog 在 Node 构建阶段读取它和每个包的 `yunzhen.client` 元数据，禁用条目在依赖验证前移除。Vite 将图转为 ESM `import()` registry，生产构建同时输出相同内容的 `cordis.boot.json`。浏览器只导入图中条目；缺失的 Dashboard 不会加载其 chunk 或注册路由。

## 包职责

| 包 | 职责 |
| --- | --- |
| `@yunzhen/cordis-client-modules` | WebBootGraph 验证、浏览器 ESM 导入/激活、失败呈现与 UI 挂载。 |
| `@yunzhen/cordis-ui-slots` | 纯 `SlotMap` / `SlotCore`，支持 `root`、`single`、`list` 与唯一 `root` scope。 |
| `@yunzhen/cordis-ui-renderer` | `ctx.slots` 的 SlotRegistry Service，以及 `ctx.uiRenderer` 的唯一 React 根挂载。 |
| `@yunzhen/cordis-ui-router` | `ctx.routes` 的 RouteRegistry、React Router 适配和 Route 的 Slot owner。 |
| `@yunzhen/cordis-ui-layout` | `ctx.layout` 面板动作和无路径 `app-layout` 三栏 Route。 |
| `@yunzhen/cordis-ui-i18n` | `ctx.i18n`、浏览器语言识别、用户选择持久化与 i18next React Provider。 |
| `feature/dashboard`、`feature/settings-appearance`、`feature/settings-language` | 通过 Cordis `inject` + `apply` 注册 Route、Slot 或设置贡献，并拥有各自文案资源。 |
| `ui/settings-layout` | `/settings` 路由壳、设置侧栏、底部 Settings 入口与 `ctx.settings.register()`。 |
| `ui/theme` | ThemeRuntime、token 与 DOM 同步；具体设置页面由独立扩展提供。 |

旧的 `core/runtime`、`react/bridge`、`router/react-router` 与 `ui/shell` 分层已不属于当前实现。

## 多语言

`ui/i18n` 目前提供 `zh-CN` 与 `en-US`。首次启动优先使用浏览器语言（任一 `zh*` 选择 `zh-CN`，其余选择 `en-US`）；用户在语言设置页选择后写入 localStorage。renderer 在唯一 React 根部包裹 i18next Provider，语言变更会刷新所有 Slot 与 Route 组件。

功能包将自己的 `zh-CN` / `en-US` 资源通过 `ctx.i18n.register()` 注册到共享词典；不要集中维护应用级大词典。Route 导航和设置项保持英文 `label` 作为回退，并可提供 `labelKey`，供宿主在渲染时翻译，从而确保侧栏菜单同样随语言切换刷新。

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

Dashboard 和 Settings 都是 `app-layout` 的子 Route；命中 Settings 时其 route Sidebar 替换默认应用侧栏。设置扩展通过 `ctx.settings.register()` 同时注册菜单与 `/settings/:id` 页面；Appearance 是首个扩展。`ctx.layout` 仅管理侧栏与工作台开关；不持久化尺寸、不支持拖拽或响应式自动折叠。

## 部署边界

开发期 Vite 进程可读取 `apps/web/cordis.yml` 生成虚拟 registry；生产环境仅托管 `apps/web/dist` 的静态文件和 ESM chunks。生产不运行 Node catalog 扫描，不支持 HMR、远程插件、运行时安装或动态运行器。
