# Agent 模型选择器设计

## 目标

在 `examples/agent` 中展示多个大模型，并让当前聊天在发送前选择其中一个模型。示例直接由浏览器调用厂商接口；不引入后端、密钥管理、持久化或设置页。

## 模块

新增两个 Cordis 客户端插件。

| 插件 | 职责 | 不负责 |
| --- | --- | --- |
| `@examples/agent-models` | 暴露模型目录和统一流式调用 | 聊天 UI、当前选择、会话保存 |
| `@examples/agent-chat` | 注册聊天路由/Slot，渲染消息与模型选择器 | 厂商协议、模型配置 |

`models` 是唯一跨插件的 Seam。它提供模型列表、默认模型 ID，以及 `stream({ modelId, messages, signal })`。聊天插件只依赖这个 Interface，不导入 AI SDK 或厂商包。

## 配置与启动

`cordis.yml` 增加 `models` 和 `chat` 条目，顺序为 models 在前、chat 在后。模型定义作为 `models` 的 JSON 配置，包含稳定的 `id`、显示名、`baseURL` 与厂商模型名；不包含密钥。

包元数据的 `yunzhen.client.inject` 使用包名，使静态启动图加载 models 后再加载 chat。插件源码的 `inject` 使用 Cordis 服务名，例如 chat 注入 `models`、`routes`、`slots` 与 `i18n`；两者不可混用。

## 交互与状态

聊天页的 React 状态保存 `selectedModelId`，初始值为 `models.defaultModelId`。选择器只影响当前页面的后续请求；刷新或新建页面恢复默认模型。不写入 localStorage，也不注册设置项。

模型目录不识别的 ID 必须在发起请求前报错。流式请求应接受 `AbortSignal`，让聊天页可停止生成；网络和厂商错误应保留模型显示名并呈现在当前回复区域。

## 验证

- `agent-models`：验证配置、默认模型和未知模型拒绝；以 mock fetch 验证流的协议转换，不发真实网络请求。
- `agent-chat`：验证模型选择改变传给 `models.stream()` 的 ID，以及停止时传递 abort。
- 运行对应 Vitest、`pnpm typecheck`、`pnpm --filter @examples/agent build` 和 `git diff --check`。

## 排除范围

不做厂商独立插件、模型设置页、密钥输入、后端代理、会话/选择持久化、工具调用或动态插件加载。若未来出现非 OpenAI 兼容协议，再在 `agent-models` 内增加真实的厂商 Adapter；只有它拥有独立生命周期时才提升为插件。
