# 首版 UI Theme 设计

## 目标

新增 `@yunzhen/cordis-ui-theme`，使主题和内容字号成为由 Cordis 组合的基础能力：主题包拥有状态、持久化、DOM 同步和设置项；Settings 页面只展示已注册的设置项。

首版对齐 `@deepseek-ai/dsh-client-ui-theme` 的职责划分，但保持纯浏览器实现：不引入 Node Settings 服务、远端同步、第三方主题包或运行时主题安装。

## 架构

```text
index.html 内联引导
  └─ localStorage + prefers-color-scheme
       └─ documentElement[data-theme] / color-scheme / --app-content-font-size

@yunzhen/cordis-ui-theme
  ├─ ThemeRuntime：状态、存储、系统主题监听、DOM 更新
  ├─ 全局 Token CSS：按 data-theme 生效
  ├─ app.provide('theme', theme)
  └─ app.addSettingsItem(AppearanceSettingsItem)

@yunzhen/cordis-feature-settings
  └─ 按 order 渲染 runtime.settingsItems
```

`packages/core/runtime` 是上述贡献的唯一 seam。它增加类型化服务表、`provide()` / `get()` 和 `addSettingsItem()`；不增加事件总线、模块加载器或通用状态容器。其 interface 为 `AppServices` 声明合并表，以及以其键为泛型参数的 `provide()` / `get()`。`ui-theme` 通过声明合并把 `theme` 加入服务表，其他功能包可读取它而不导入其内部实现。

## ThemeRuntime

`ThemeRuntime` 是 `ui-theme` 的深模块，外部 interface 仅包含：读取快照、订阅变更、设置主题偏好、设置内容字号。实现内部处理下列行为：

- 主题偏好只允许 `system`、`light`、`dark`；默认 `system`。
- 有效主题由偏好与 `matchMedia('(prefers-color-scheme: dark)')` 得出；仅 `system` 时监听系统变化。
- 内容字号默认 `16px`，可选范围为 `12–20px`；仅写入 `--app-content-font-size`，不缩放导航或全局布局。
- 偏好和字号分别存入 `@yunzhen/cordis-ui-theme:preference` 与 `@yunzhen/cordis-ui-theme:font-size`；缺失、损坏或超出范围的值回退默认值。若浏览器拒绝访问 `localStorage`，主题仍在当前页面可用，只是不持久化。
- 每次状态变更更新 `document.documentElement.dataset.theme`、`color-scheme` 和 CSS 自定义属性，再通知订阅者。

插件卸载时停止媒体查询监听、移除其注入的样式和设置项，并撤销 `theme` 服务。应用运行时仍负责整体 Cordis fiber 的 dispose 生命周期。

## 启动与样式

`apps/web/index.html` 在 React 入口之前执行一个小型内联引导脚本。它从同一组固定存储键恢复值、解析 `system` 偏好并写入 DOM，避免首屏按默认主题绘制后再切换。React 启动后 `ThemeRuntime` 重新读取并接管该状态；引导脚本不保存订阅或业务状态。

全局 Token CSS 随 `ui-theme` 包注入，使用 `[data-theme='light']` 与 `[data-theme='dark']` 提供 `--app-*` 颜色和层级变量。壳、Settings 外观项和功能页继续使用原生 CSS Modules；不引入 Tailwind、Sass、Less 或运行时 CSS-in-JS。

## Settings 贡献

Core 定义最小 `SettingsItem`：稳定 `id`、数字 `order` 和 React `Component`。`ui-theme` 注册一个外观项，包含主题三选一与内容字号控件。`feature/settings` 只取得运行时设置项、按 `order` 排序并渲染，不知道主题存储键、系统偏好或 Token。

这样新增内置设置能力只需在对应功能插件调用 `addSettingsItem()`；首版不定义第三方 Settings 插件兼容性或设置分类体系。

## 组合顺序

`bundle/web-app` 将 `uiThemePlugin` 与 Dashboard、Settings 插件一起静态导入。主题插件在应用启动时完成全局样式、主题服务和设置项注册；路由仍在启动后一次性汇总，保持首版静态路由模型。

## 验证

- `ThemeRuntime` 单元测试覆盖：默认值、localStorage 恢复和回退、`system` 跟随媒体查询、显式切换、字号边界、DOM 同步与订阅。
- `ui-theme` 插件测试覆盖：注册 `theme` 服务和一项外观设置、dispose 后撤销贡献与监听。
- Settings 测试覆盖：按 `order` 显示注册项而不导入 `ui-theme`。
- 运行完整 `test`、`typecheck`、`build`；浏览器冒烟确认 Dashboard/Settings 导航、主题切换和刷新恢复。

## 非目标

- Node Settings 服务、用户账户同步或跨设备同步。
- 自定义主题注册、Token 覆盖、主题市场或第三方插件发现。
- 运行时新增/删除路由。
- 整页缩放、响应式字号规则或多套排版方案。
