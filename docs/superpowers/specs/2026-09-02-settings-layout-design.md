# 可扩展设置布局设计

## 目标

将设置从应用主导航中的普通页面升级为独立的路由壳：进入 `/settings` 后，应用左栏替换为设置导航，主内容区展示当前设置页面。设置功能包通过一个注册契约同时贡献菜单项和页面，不重复维护导航与路由。

首个入口为应用默认侧栏底部的 Settings 齿轮按钮，使用 `lucide-react` 的 `Settings` 图标。点击后进入 `/settings`；设置侧栏顶部提供“返回应用”。

## 范围与非目标

- 提供 `@yunzhen/cordis-ui-settings-layout`，它只拥有设置路由壳、设置侧栏和注册表。
- `@yunzhen/cordis-ui-theme` 保持基础主题能力，不直接注册任何设置页面。
- 新的 `@yunzhen/cordis-feature-settings-appearance` 作为首个扩展，复用 ThemeRuntime 注册外观页面。
- 设置页采用深色、窄左栏、宽内容区、分类标题与当前项高亮的桌面布局；复用现有主题 token。
- 不实现远端同步、权限、设置搜索、运行时安装或通用表单控件。搜索在设置项足够多且有明确筛选需求时再加入。

## 包边界

```text
@yunzhen/cordis-ui-router
  └─ 路由定义可选 Sidebar；命中该路由时替换默认应用侧栏

@yunzhen/cordis-ui-settings-layout
  ├─ SettingsRegistry（ctx.settings.register）
  ├─ SettingsLayout（右侧 Outlet）
  ├─ SettingsSidebar（返回应用、分组菜单）
  └─ 默认侧栏底部 Settings 入口

@yunzhen/cordis-ui-theme
  └─ ThemeRuntime、token 与 DOM 同步，不含设置页面注册

@yunzhen/cordis-feature-settings-appearance
  └─ 注册“个人 / 外观”及 AppearanceSettings 页面
```

一个领域扩展可注册多个强相关设置页面；不同领域（外观、快捷键、集成、模型等）保持为独立包。设置布局包不依赖任一领域扩展。

## 路由与侧栏替换

`RouteDefinition` 增加可选 `Sidebar` 组件。Router 根据当前匹配路由，从最深层向上选择第一个 `Sidebar`；未命中时继续渲染现有应用导航。

设置布局包注册：

```text
app-layout
├─ dashboard（现有 index route）
└─ settings（path: settings，SettingsLayout，Sidebar: SettingsSidebar）
   └─ settings.appearance（path: appearance，AppearanceSettings）
```

访问 `/settings` 时，SettingsLayout 将重定向至按顺序的首个已注册设置项；访问 `/settings/:id` 由 Router 渲染对应扩展页面。应用默认侧栏的 footer 入口始终存在，但当 `/settings` 命中时由 SettingsSidebar 取代，避免重复显示。

## 设置扩展契约

`SettingsRegistry` 暴露以下最小 API：

```ts
interface SettingsEntry {
  id: string
  group: { id: string; label: string; order: number }
  label: string
  Icon?: ComponentType<{ size?: number; strokeWidth?: number }>
  order: number
  Component: ComponentType
}

ctx.settings.register(entry): () => void
```

`id` 同时决定稳定的 route id 与相对 URL（`appearance` 对应 `/settings/appearance`）。`group.id` 是稳定分组标识；同一分组的 label 与 order 必须一致。注册表拒绝重复 id、空标签、空分组、非法 id 与非有限排序值。它负责将 entry 注册为 `settings` 的子路由，并维护菜单快照；调用扩展 Fiber 停止时，菜单与路由一并移除。

SettingsSidebar 按 `group` 和 `order` 输出菜单，菜单项使用 `NavLink` 以获取当前路由高亮。SettingsLayout 的内容标题取自当前 entry，并在右侧 `<Outlet />` 中渲染页面。首个 Appearance 页面继续使用既有 `AppearanceSettings` 组件；其容器样式移入新 feature 包，以免 ui-theme 依赖设置布局。

## 启动图

`apps/web/cordis.yml` 的内置条目替换为：

```text
settings-layout
theme
settings-appearance
```

依赖顺序为：settings-layout 依赖 router；theme 仍依赖 renderer；settings-appearance 同时依赖 settings-layout 和 theme。默认 footer 的齿轮图标由 settings-layout 自己提供，因此 `lucide-react` 是该包的直接依赖；扩展可选图标由各自包直接依赖或不提供。

## 交互与视觉

- 默认应用侧栏底部：齿轮图标加 “Settings” 标签，键盘可聚焦，`aria-current` 由 NavLink 提供。
- 设置侧栏：顶部“返回应用”链接；下方为分组标题和设置项。当前项使用低对比度填充与清晰文字色。
- 设置内容：保留应用全局左栏宽度；右侧主内容限制可读宽度，标题与内容卡片分层，使用现有 `--app-*` token。
- 小屏行为沿用 AppLayout 的侧栏自动收起规则；不为设置页创建第二套响应式状态机。

## 验收与测试

1. Router 测试覆盖 route Sidebar 覆盖默认导航及离开 `/settings` 后恢复默认导航。
2. SettingsRegistry 测试覆盖注册、分组排序、重复/非法输入、子路由生成和 Fiber 清理。
3. SettingsLayout 测试覆盖 `/settings` 重定向、侧栏“返回应用”、当前项高亮和菜单/内容双栏。
4. Appearance 扩展测试覆盖其在 ThemeRuntime 存在时注册 `/settings/appearance`，并继续展示现有外观控件。
5. Web 应用测试覆盖默认 footer 齿轮跳转设置，以及完整静态构建。
