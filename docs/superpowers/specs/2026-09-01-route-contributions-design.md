# 路由贡献模型设计

> 已被 [2026-09-01-deepseek-aligned-plugin-runtime-design.md](2026-09-01-deepseek-aligned-plugin-runtime-design.md) 取代。本文保留为此前 `core/runtime` 路由树方案的历史设计记录；当前实现使用 `ctx.routes`、`parentId`、页面 Slot 和无路径 `app-layout` Route。

## 目标

将首版扁平 `Page` 贡献替换为可嵌套的 `RouteNode` 树，使功能包能拥有自己的布局路由、子路由、错误边界和导航元信息，同时保持 `core/runtime` 不依赖 React Router 的 `RouteObject`。

本次只重构内置静态路由组合。路由仍在应用启动时一次性创建；不支持第三方插件、运行时安装/卸载路由、数据路由 `loader/action`、权限守卫或页面标题管理。

## 路由贡献

`packages/core/runtime` 删除 `Page`、`addPage()` 和 `AppRuntime.pages`，新增以下 module interface：

```ts
export interface RouteNavigation {
  label: string
  order: number
}

export interface RouteNode {
  id: string
  Component: ComponentType
  path?: string
  index?: boolean
  ErrorComponent?: ComponentType
  children?: readonly RouteNode[]
  navigation?: RouteNavigation
}

export interface AppContext {
  addRoute(route: RouteNode): () => void
}

export interface AppRuntime {
  readonly routes: readonly RouteNode[]
}
```

`addRoute()` 是功能包声明路由的唯一 seam。一个功能包可调用它一次贡献一整棵分支；子节点由该功能包拥有。首版不提供跨功能包向同一父路由追加 children 的机制。

`RouteNode` 只表达框架无关的结构和 React 组件。`React.lazy()` 本身就是 `Component`，因此代码分割无需新契约。React Router 专用的 `loader`、`action`、`handle` 和 `RouteObject` 保持在路由适配包内。

## 校验与生命周期

`createAppRuntime()` 在插件执行完成后递归校验整棵树。任一错误都应拒绝启动，不得悄悄丢弃路由：

- `id` 在全树唯一。
- 每个节点都有 `Component`。
- `index` 节点没有 `path`，且同一 children 集合最多一个 index 节点。
- 非 index 的 `path` 为非空相对片段：不得以 `/` 开头，也不得是 `.` 或 `..`；`workspace/:id` 合法。
- 同级非 index 节点的原始 `path` 不重复。
- 有 `navigation` 的节点必须是 index 节点或拥有 `path`。

`AppRuntime.routes` 返回数组副本；`addRoute()` 的 disposer 仅移除自己的顶层节点，与现有 Settings/Page 贡献的生命周期一致。路由注册顺序不决定导航顺序，导航稳定性由必填的 `navigation.order` 决定。

## React Router 适配

`packages/router/react-router` 是唯一把 `RouteNode` 转换为 React Router 路由的 module：

```text
createBrowserRouter
  └─ 根路由：AppShell + 默认 ErrorComponent
       ├─ 递归转换 runtime.routes
       └─ path="*"：默认 NotFoundPage
```

转换规则如下：

- `Component` 映射到 React Router 的 `Component`。
- `ErrorComponent` 存在时映射到该路由的 `ErrorBoundary`；否则由根默认错误页处理。
- `index: true` 映射为 React Router 的 index route；其余 `path` 保持相对值。
- `children` 递归映射。布局组件自行使用 `<Outlet />`，Router 不注入布局行为。

默认 `NotFoundPage` 与默认错误页属于 `router/react-router`，不是业务功能包。这样所有内置功能都处于唯一 `AppShell` 根布局下，功能包无法替换应用壳。

## Shell 导航

`ui/shell` 从 `runtime.routes` 深度遍历出带 `navigation` 的节点，并在遍历时拼接相对路径，得到可访问 URL：

- index 节点继承父路径；根 index 解析为 `/`。
- `path: 'settings'` 解析为 `/settings`；嵌套 `workspace/:id` 继续拼接。
- 结果以 `navigation.order` 升序排序；`id` 只作为稳定的 React key，不参与排序。

Shell 仅渲染这些导航项。无 `navigation` 的布局/子路由不会出现在侧栏。根路径链接使用 `end`，其余链接保留 React Router 的嵌套 active 行为。

## 内置功能迁移

Dashboard 改为根 index 路由：

```ts
app.addRoute({
  id: 'dashboard',
  index: true,
  Component: DashboardPage,
  navigation: { label: 'Dashboard', order: 0 },
})
```

Settings 改为相对路径路由：

```ts
app.addRoute({
  id: 'settings',
  path: 'settings',
  Component: SettingsPage,
  navigation: { label: 'Settings', order: 100 },
})
```

`bundle/web-app` 继续静态导入 Dashboard、Settings 和主题插件，保持当前组合顺序。

## 验证

- Runtime 测试：路由树收集、disposer、唯一 id、index/path 互斥、相对路径、同级重复路径、多个 index 与无路径导航节点均有明确失败断言。
- Router 测试：根 `AppShell`、嵌套子路由、每路由错误边界和默认 404/错误页转换正确。
- Shell 测试：相对路径解析、嵌套导航提取、按 order 排序、根路径的精确 active 行为。
- Bundle 测试：内置 Dashboard/Settings 的 id、路径、导航 metadata 与主题设置项仍完整。
- 运行完整 `test`、`typecheck`、`build`，并浏览器验证 Dashboard、Settings 与 404；嵌套路由和错误边界由 Router 单元测试覆盖，不额外添加展示型示例页面。
