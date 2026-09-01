# 布局 Slots 设计

## 目标

让仓库内功能包能把轻量 React UI 放入应用壳的受控位置，而不修改 `ui/shell`，也不耦合 React Router。首版只服务现有 Shell，不实现任意布局、嵌套 Slots、运行时安装或第三方插件。

## 贡献契约

`packages/core/runtime` 新增关闭的 Slot 名称集合：

```ts
export type AppSlot = 'shell.navigation.footer' | 'shell.content.header'

export interface SlotItem {
  id: string
  slot: AppSlot
  order: number
  Component: ComponentType
}

export interface AppContext {
  addSlotItem(item: SlotItem): () => void
}

export interface AppRuntime {
  getSlotItems(slot: AppSlot): readonly SlotItem[]
}
```

`addSlotItem()` 是唯一的布局贡献 seam。它的 disposer 只移除自己注册的项目，和现有路由、Settings 贡献保持相同生命周期。Slots 与路由树一样仅在启动阶段组合；Shell 不订阅增量更新。

`getSlotItems()` 返回按 `order` 升序排列的数组副本。每个 slot 内的 `id` 与 `order` 必须唯一，`order` 必须是有限数值；冲突在 `createAppRuntime()` 完成插件启动后拒绝应用，而不是由注册顺序悄悄决定布局。

## Shell 位置

`packages/ui/shell` 只增加两个固定渲染位置：

```text
AppShell
├─ navigation
│  ├─ route navigation
│  └─ shell.navigation.footer
└─ main
   ├─ shell.content.header
   └─ Outlet
```

Shell 直接调用 `runtime.getSlotItems(slot)` 并渲染每个 `Component`；不创建通用 Layout service、配置对象或嵌套渲染器。`shell.content.header` 没有项目时不生成空容器。侧栏使用纵向 flex，让 footer 贴在底部。

## 内置示例

`ui/theme` 新增一个轻量 `ThemeToggle`，贡献到 `shell.content.header`。它复用现有 `ThemeRuntime`，在 light/dark 间切换并继续写入既有 `localStorage` 偏好；完整的 system、字体大小等配置仍只在 Settings 的 Appearance 项中处理。

`shell.navigation.footer` 首版没有内置贡献。它保留给账户、工作区状态等真正需要侧栏底部位置的后续功能，不添加展示性占位 UI。

## 边界

- 不引入 `ctx.layout`、自由字符串 slot 名、slot 嵌套或跨 slot 移动。
- 不将 React Router 的 `Link`、URL、权限、命令或状态管理放入 runtime 契约。
- 不修改路由贡献、Settings 页面契约或主题 token/CSS Modules 技术选择。
- 不添加第三方依赖。

## 验证

- Runtime 测试覆盖 slot 收集、排序、不可变快照、disposer，以及同 slot 重复 id/order 和非法 order 的启动失败。
- Shell 组件测试覆盖 header/footer 的实际位置和空 header 不渲染。
- Theme 测试覆盖切换行为与 header slot 贡献；Bundle 测试断言内置 slot 项已组合。
- 运行完整 `test`、`typecheck`、`build`，并在浏览器检查 Dashboard、Settings、主题切换和 404。
