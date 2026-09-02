# Agent ProseMirror Composer 设计

## 目标

将 `examples/agent` 的聊天输入从受控 `textarea` 替换为 ProseMirror 编辑器，并保持当前模型选择、流式发送和停止生成的行为。首版只发送纯文本；它为之后的文件引用和复杂粘贴建立单一输入文档模型，但不实现这些能力。

## 模块与接口

不新增 Cordis 插件或跨插件 Service。`@examples/agent-chat` 内新增私有 `ChatComposer` module；它是编辑器生命周期、schema、键盘语义和文本序列化的唯一拥有者。

```text
ChatComposer
  onSend(text: string)
  disabled: boolean
  focus?(): void

ChatPage
  接收纯文本，创建 ChatMessage，再调用 ctx.models.stream()
```

`ChatComposer` 的 Interface 不暴露 `EditorView`、Transaction 或 ProseMirror Node。聊天页不保存受控编辑器文本，也不直接修改编辑器状态；它只处理已确认可发送的文本。这样后续将引用节点或粘贴规则加入 composer 时，模型目录和聊天流式状态不需要变化。

## 文档模型与交互

首版 schema 只允许：`doc`、`paragraph`、`text`。多段文字按换行序列化为发送文本，并在空白文本时禁止发送。

- Enter：未处于 IME composition 时发送；
- Shift+Enter：保留 ProseMirror 的默认换行行为；
- composition：不触发发送，确保中文等输入法正确提交候选文本；
- 流式生成：`disabled` 使编辑器不可编辑，停止或完成后恢复；
- 发送成功：由 composer 清空本次已发送内容；错误仍由现有 assistant 消息区域呈现。

首版不包含工具栏、Markdown 自动转换、链接 mark、文件/工作区引用节点、slash 菜单、历史持久化或粘贴转换。它们都只在有明确交互规格后作为 `ChatComposer` 的内部扩展加入。

## 依赖与实现位置

`@examples/agent-chat` 添加 ProseMirror 的最小包集合：`prosemirror-model`、`prosemirror-state`、`prosemirror-view`、`prosemirror-keymap`、`prosemirror-commands` 与 `prosemirror-history`。不引入 Tiptap、Starter Kit 或其 UI Components。

变更文件限于：

- `examples/agent/plugins/chat/package.json` 与 lockfile；
- `examples/agent/plugins/chat/src/chat-composer.tsx`；
- `examples/agent/plugins/chat/src/index.tsx`；
- 对应的 chat Vitest 测试。

## 验证

- Composer：渲染最小文档、Enter 发送、Shift+Enter 保留换行、IME 期间不发送、disabled 不可编辑。
- Chat：Composer 发送的纯文本仍传给所选模型，现有停止流式生成测试继续通过。
- 执行 chat 目标 Vitest、`pnpm typecheck`、`pnpm --filter @examples/agent build` 和 `git diff --check`。

## 扩展触发条件

文件引用或复杂粘贴需要可编辑的非文本 token、结构化序列化或自定义粘贴规则时，扩展当前 schema 和 composer 内部转换；只有会话持久化、工具事件或审批状态被多个页面共享时，才另设 conversation module。
