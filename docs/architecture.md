# starter-react-cordis 首版架构

## 目标

提供一个面向复杂 React 应用的 monorepo 模板：以 Cordis 管理功能组合，以 React 负责渲染，以 React Router 负责 URL 路由。

首版只加载仓库内、随构建产物发布的可信功能包；不支持第三方插件、远程模块或运行时安装。

## 分层

```text
apps/web
  └─ bundle/web-app
       ├─ feature/dashboard
       └─ feature/settings

apps/web ──> react/bridge, router/react-router, ui/shell
所有包 ──> core/runtime
core/runtime ──> @deepseek-ai/cordis
```

`core/runtime` 是 Cordis 的唯一直接封装点，定义应用插件和贡献项的最小契约。功能包依赖该契约，不直接耦合 Cordis 的具体 API。

## 包职责

| 包 | 职责 | 是否为业务插件 |
| --- | --- | --- |
| `apps/web` | Vite 入口；启动运行时并渲染 React 根节点 | 否 |
| `packages/core/runtime` | 创建 Cordis 上下文；收集功能贡献 | 否 |
| `packages/react/bridge` | 将运行时贡献暴露给 React | 否 |
| `packages/router/react-router` | 从路由贡献一次性创建 React Router | 否 |
| `packages/ui/shell` | 侧栏、顶部栏、主内容区和 `<Outlet />` | 否 |
| `packages/feature/dashboard` | 默认页和导航项 | 是 |
| `packages/feature/settings` | 设置页和导航项 | 是 |
| `packages/bundle/web-app` | 静态导入并组合内置业务插件 | 否 |

## 启动流程

1. `apps/web` 创建应用运行时。
2. `bundle/web-app` 挂载 `dashboard` 与 `settings`。
3. 功能插件注册路由和导航贡献。
4. `router/react-router` 汇总路由，创建一次 `createBrowserRouter()`。
5. `ui/shell` 渲染导航与 `<Outlet />`。

路由在启动后保持静态。以后若要支持运行时安装或卸载插件，需要重新设计路由更新、版本兼容和安全边界；首版不预留这套机制。

## 插件边界

业务功能使用插件形式，是为了独立声明它提供的路由、导航和将来的命令，而不是为了让每个包都成为插件。

基础运行时、React 适配、React Router 适配和应用壳保持普通模块。这与 DeepSeek Harness 的分层一致：基础启动和运行时是基础设施，按功能组织的能力包才通过 Cordis 组合。

## 目录

```text
apps/web/
packages/core/runtime/
packages/react/bridge/
packages/router/react-router/
packages/ui/shell/
packages/feature/dashboard/
packages/feature/settings/
packages/bundle/web-app/
docs/architecture.md
```
