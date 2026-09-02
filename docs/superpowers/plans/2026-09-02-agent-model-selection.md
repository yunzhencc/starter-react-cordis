# Agent 模型选择器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `examples/agent` 增加 OpenAI、DeepSeek 与 Qwen 的模型目录，以及带当前模型选择器的流式聊天页面。

**Architecture:** `@examples/agent-models` 是唯一的模型调用模块：它验证静态目录、以 AI SDK 的 OpenAI-compatible Provider 统一流式调用，并向 Cordis 提供 `ctx.models`。`@examples/agent-chat` 仅贡献 `/chat` Route 与聊天 UI；它在页面内维护当前选择并调用 `ctx.models.stream()`，不认识厂商 SDK。

**Tech Stack:** TypeScript 6、React 19、Cordis 4、Vite 8、Vitest 4、AI SDK、`@ai-sdk/openai-compatible`。

**Spec:** `docs/superpowers/specs/2026-09-02-agent-model-selection-design.md`

## Global Constraints

- 首版仅支持 OpenAI-compatible Chat Completions；OpenAI、DeepSeek、Qwen 的差异只存在于模型目录配置。
- 不实现密钥输入、密钥存储、后端代理、设置页、会话或模型选择持久化、工具调用、动态插件加载。
- `cordis.yml` 只保存公开的模型元数据；缺少运行时凭据时，让请求返回明确错误，不伪造成功响应。
- 模型目录使用包元数据 `yunzhen.client.inject` 排序；插件代码的 `inject` 仅使用 Cordis 服务名。
- 每个包继续只导出 Cordis `{ inject, apply }`，并在自己的 `package.json` 中直接声明运行时依赖。

---

## File Structure

| File | Responsibility |
| --- | --- |
| `examples/agent/plugins/models/src/index.ts` | `ModelsConfig` 验证、`ModelRegistry`、`ctx.models` 与 AI SDK 流转换。 |
| `examples/agent/plugins/models/src/index.test.ts` | 配置、未知模型与模拟流式请求的契约测试。 |
| `examples/agent/plugins/chat/src/index.tsx` | `/chat` Route、模型选择器、消息和 abort 生命周期。 |
| `examples/agent/plugins/chat/src/index.test.tsx` | 选择模型、发送与停止生成的 DOM 行为。 |
| `examples/agent/cordis.yml` | OpenAI、DeepSeek、Qwen 的静态目录与两个插件条目。 |
| `examples/agent/package.json` | 使 Vite 可解析两个新的工作区客户端插件。 |

### Task 1: Add the model-directory Cordis plugin

**Files:**
- Create: `examples/agent/plugins/models/package.json`
- Create: `examples/agent/plugins/models/tsconfig.json`
- Create: `examples/agent/plugins/models/src/index.ts`
- Create: `examples/agent/plugins/models/src/index.test.ts`
- Modify: `examples/agent/package.json`
- Modify: `examples/agent/cordis.yml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `ModelDefinition`, `ModelsConfig`, `ModelStreamRequest`, `ModelRegistry`, and `ctx.models`.
- `ModelRegistry.snapshot(): readonly ModelDefinition[]` returns immutable public metadata.
- `ModelRegistry.defaultModelId: string` identifies one entry in `snapshot()`.
- `ModelRegistry.stream(request: ModelStreamRequest): AsyncIterable<string>` emits text deltas for the requested model or throws before fetching for an unknown ID.

- [ ] **Step 1: Write the failing model registry tests**

Create `src/index.test.ts` with a context boot helper and this configuration:

```ts
const config = {
  defaultModel: 'deepseek-chat',
  models: [{
    id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'test-key',
  }],
}

const fiber = ctx.plugin({ inject, apply }, config)
await fiber.await()
expect(ctx.models.defaultModelId).toBe('deepseek-chat')
expect(ctx.models.snapshot()).toEqual([{
  id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat',
}])
await expect(collect(ctx.models.stream({ modelId: 'missing', messages: [] })))
  .rejects.toThrow('unknown model: missing')
```

Stub `globalThis.fetch` to return an SSE `Response` containing one OpenAI-compatible `chat.completion.chunk` with `choices[0].delta.content: 'Hello'`, followed by `[DONE]`. Call `collect()` on `ctx.models.stream()` and assert `['Hello']`; assert the request targets `https://api.deepseek.com/v1/chat/completions`, uses `POST`, and includes `model: 'deepseek-chat'`. Add invalid-config cases for duplicate IDs, blank label/baseURL/model, and a default ID absent from `models`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/models/src/index.test.ts`

Expected: FAIL because `@examples/agent-models` and `ctx.models` do not exist.

- [ ] **Step 3: Add the package and resolve its dependencies**

Create `package.json` following `agent-dashboard`: name it `@examples/agent-models`, export `.` and `./client` from `src/index.ts`, add web client metadata with `platform: 'web'`, no package injections, and `immediately: false`. Declare direct dependencies on `@deepseek-ai/cordis`, `ai`, and `@ai-sdk/openai-compatible`. Create the same web `tsconfig.json` used by the dashboard plugin.

Add `@examples/agent-models` to `examples/agent/package.json`, then resolve the lockfile with:

```bash
pnpm add --filter @examples/agent-models ai @ai-sdk/openai-compatible
```

- [ ] **Step 4: Implement the small public model Interface**

In `src/index.ts`, define the public types and Cordis context augmentation:

```ts
export interface ModelDefinition {
  id: string
  label: string
  provider: string
  baseURL: string
  model: string
}

export interface ModelStreamRequest {
  modelId: string
  messages: ModelMessage[]
  abortSignal?: AbortSignal
}

declare module '@deepseek-ai/cordis' {
  interface Context { models: ModelRegistry }
}
```

Keep `apiKey?: string` in the private parsed configuration only; do not expose it from `snapshot()`. Validate the configuration synchronously before registering the service. `apply(ctx, config)` creates `ModelRegistry`, and uses `ctx.reflect.provide('models', models)` under the plugin Fiber.

Implement `stream()` with `createOpenAICompatible({ name: entry.provider, baseURL: entry.baseURL, apiKey: entry.apiKey })`, `streamText({ model: provider(entry.model), messages, abortSignal })`, and `for await (const text of result.textStream) yield text`. Lookup the entry before constructing the Provider and throw `unknown model: ${modelId}` if absent. Do not add a vendor-specific class or cache; all three configured vendors use this one protocol.

- [ ] **Step 5: Register the three static models**

In `examples/agent/cordis.yml`, add the `models` entry before UI feature plugins:

```yml
- id: models
  name: '@examples/agent-models'
  config:
    defaultModel: deepseek-chat
    models:
      - id: openai-gpt-4.1
        label: OpenAI GPT-4.1
        provider: openai
        baseURL: https://api.openai.com/v1
        model: gpt-4.1
      - id: deepseek-chat
        label: DeepSeek Chat
        provider: deepseek
        baseURL: https://api.deepseek.com/v1
        model: deepseek-chat
      - id: qwen-plus
        label: Qwen Plus
        provider: qwen
        baseURL: https://dashscope.aliyuncs.com/compatible-mode/v1
        model: qwen-plus
```

Do not put any API key in this file.

- [ ] **Step 6: Verify and commit the directory plugin**

Run:

```bash
CI=true pnpm exec vitest run examples/agent/plugins/models/src/index.test.ts
CI=true pnpm --filter @examples/agent-models exec tsc --noEmit
git diff --check
```

Expected: PASS; the registry hides credentials, rejects invalid entries before network work, and turns the mocked OpenAI-compatible SSE response into text deltas.

```bash
git add examples/agent/package.json examples/agent/cordis.yml examples/agent/plugins/models pnpm-lock.yaml
git commit -m "feat(agent): add model directory"
```

### Task 2: Add the chat route and model selector

**Files:**
- Create: `examples/agent/plugins/chat/package.json`
- Create: `examples/agent/plugins/chat/tsconfig.json`
- Create: `examples/agent/plugins/chat/src/index.tsx`
- Create: `examples/agent/plugins/chat/src/index.test.tsx`
- Modify: `examples/agent/package.json`
- Modify: `examples/agent/cordis.yml`
- Modify: `examples/agent/vite-plugin.test.ts`

**Interfaces:**
- Consumes `ctx.models.snapshot()`, `ctx.models.defaultModelId`, `ctx.models.stream()`, plus existing `routes`, `slots`, and `i18n` services.
- Produces an `app-layout` child route with id `chat`, path `chat`, navigation label `Chat`, and a chat page containing a labelled `<select>`.
- The current `selectedModelId`, messages, and `AbortController` exist only in `ChatPage` state.

- [ ] **Step 1: Write the failing chat page test**

Create `src/index.test.tsx` using the dashboard test's jsdom boot pattern. Add a fake `models` Cordis module before the chat plugin that provides:

```ts
const stream = vi.fn(async function* ({ modelId, abortSignal }: ModelStreamRequest) {
  expect(abortSignal?.aborted).toBe(false)
  yield `${modelId}: first`
  await new Promise(resolve => abortSignal?.addEventListener('abort', resolve, { once: true }))
})

ctx.reflect.provide('models', {
  defaultModelId: 'deepseek-chat',
  snapshot: () => [
    { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek', baseURL: '', model: '' },
    { id: 'qwen-plus', label: 'Qwen Plus', provider: 'qwen', baseURL: '', model: '' },
  ],
  stream,
})
```

Mount `/chat`, select `qwen-plus`, enter `Hi`, and click Send. Assert `stream.mock.calls[0][0].modelId` is `qwen-plus` and the page contains `qwen-plus: first`. Click Stop and assert the signal supplied to the call is aborted. Unmount and dispose all Fibers.

In `examples/agent/vite-plugin.test.ts`, add this catalog regression beside the existing boot-order test:

```ts
it('boots models before chat', () => {
  const entries = loadWebBootGraph(new URL('./cordis.yml', import.meta.url).pathname).entries
  const ids = entries.map(entry => entry.id)

  expect(ids.indexOf('models')).toBeGreaterThanOrEqual(0)
  expect(ids.indexOf('chat')).toBeGreaterThan(ids.indexOf('models'))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/chat/src/index.test.tsx examples/agent/vite-plugin.test.ts`

Expected: FAIL because the chat package and `/chat` route do not exist, and the catalog does not yet contain a `chat` entry.

- [ ] **Step 3: Add the chat package and root dependency**

Create `package.json` named `@examples/agent-chat`, with `.` and `./client` exports from `src/index.tsx`. Use the dashboard's web tsconfig. Declare direct dependencies on Cordis, `@examples/agent-models`, i18n, renderer, router, React, and `react-i18next`. Its package metadata injects `@examples/agent-models`, `@yunzhen/cordis-ui-i18n`, `@yunzhen/cordis-ui-renderer`, and `@yunzhen/cordis-ui-router`.

Add `@examples/agent-chat` to `examples/agent/package.json` and add this separate static entry after `models` in `cordis.yml`:

```yml
- id: chat
  name: '@examples/agent-chat'
```

- [ ] **Step 4: Implement the route-owned page**

Export `inject = ['i18n', 'models', 'routes', 'slots']`. `apply(ctx)` registers the `chat` child route under `app-layout` through `ctx.routes.inject('app-layout', ...)`; use `path: 'chat'`, navigation `{ label: 'Chat', order: 10 }`, and a closure component receiving `ctx.models`.

`ChatPage` initializes `selectedModelId` from `models.defaultModelId`, gets options from `models.snapshot()`, and renders:

```tsx
<label>
  Model
  <select aria-label="Model" value={selectedModelId} onChange={event => setSelectedModelId(event.target.value)}>
    {models.snapshot().map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
  </select>
</label>
```

On Send, append a user message and empty assistant message, allocate one `AbortController`, then consume `models.stream({ modelId: selectedModelId, messages, abortSignal: controller.signal })`. Append each delta to that same assistant message. On any thrown error, replace its text with `Error: ${error.message}`. On Stop, call the current controller's `abort()` and clear it in `finally`. Disable Send while streaming; only show Stop while a controller exists. Do not read or write localStorage.

- [ ] **Step 5: Verify and commit the chat feature**

Run:

```bash
CI=true pnpm exec vitest run examples/agent/plugins/chat/src/index.test.tsx
CI=true pnpm exec vitest run examples/agent/vite-plugin.test.ts
CI=true pnpm --filter @examples/agent-chat exec tsc --noEmit
CI=true pnpm --filter @examples/agent build
git diff --check
```

Expected: PASS; the selector controls the current request, the streamed delta renders before completion, and Stop aborts the active request without changing global settings.

```bash
git add examples/agent/package.json examples/agent/cordis.yml examples/agent/plugins/chat examples/agent/vite-plugin.test.ts
git commit -m "feat(agent): add model selector chat"
```

## Plan Self-Review

- Spec coverage: Task 1 covers the model seam, static catalog, synchronous validation, AI SDK stream and no credential exposure. Task 2 covers the route, selector, current-page state, error text, abort, static graph ordering, and required build/typecheck checks.
- Placeholder scan: no unfinished markers, undefined function names, or generic test instructions remain; every test and implementation step names exact files and behavior.
- Type consistency: `ModelDefinition`, `ModelStreamRequest`, `ModelRegistry`, `defaultModelId`, `snapshot()`, and `stream()` are introduced in Task 1 and consumed under the same names in Task 2.
