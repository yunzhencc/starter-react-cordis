# 可插拔路由设计

## 目标

让路由成为应用组合时的可选宿主，而非 `@yunzhen/cordis-ui-layout` 的强制依赖。新增一个最小静态示例，证明 renderer、i18n、layout 和业务插件可以在没有 `@yunzhen/cordis-ui-router`、`react-router-dom` 或 URL 状态的情况下启动。

## 包边界

`@yunzhen/cordis-ui-layout` 保留三栏布局和 `ctx.layout` 面板控制服务，但不再导入路由代码、声明 `routes` 注入或注册 `app-layout` Route。它提供一个可作为应用内容根使用的布局组件；该组件声明 `sidebar`、`main`、`workbench` 与 `shell.overlay` Slots。

`@yunzhen/cordis-ui-router` 依赖 layout，并在启用时继续作为唯一的 `root` Slot 宿主。它在自己的路由树中注册无路径的 `app-layout` Route，使用 layout 提供的组件，并继续向 `main` Slot 注册 `<Outlet />`。因此现有 Agent 路由、导航和页面 Slot 生命周期保持在 Router 适配层。

无路由应用由自己的根插件向 `root` Slot 注册同一布局组件，并直接向 `main` 等布局 Slots 贡献内容。根 Slot 是 single，Router 与静态根插件不得同时加载。

## 布局行为

布局不读取 URL。右侧 workbench 仅在 `workbench` Slot 有贡献时出现。Agent 示例中 dashboard 的 workbench 贡献绑定到 dashboard Route 的页面 Slot，使离开 dashboard 时自动卸载；这取代布局对 `/settings` 的特判。

## 示例

新增 `examples/basic` 工作区及其静态页面插件。其 boot graph 只包含 i18n、renderer、layout 和页面插件；不声明 router 依赖。页面插件注册 root 布局并向 main Slot 贡献一段静态内容，作为无路由的最小可运行示例。

## 约束

- 不新增第三方依赖。
- Agent 示例仍使用 `BrowserRouter` 和现有 URL。
- 不为静态示例引入自定义导航状态或路由替代品。
- 不改动现有未跟踪的计划文档。

## 验证

- 先写布局可作为静态 root 挂载、且无需 routes 服务的失败测试。
- 覆盖 router 仍可将该布局作为 `app-layout` Route 挂载。
- 覆盖 dashboard workbench 在离开 dashboard 后卸载。
- 构建 Agent 与 basic 两个示例；运行相关测试、类型检查和 diff 检查。
