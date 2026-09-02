# Agent ProseMirror Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the agent example's textarea with a minimal ProseMirror composer that sends plain text through the existing chat stream.

**Architecture:** Keep ProseMirror wholly inside `@examples/agent-chat`. `ChatComposer` owns the editor document and converts it to plain text at the send seam; `ChatPage` remains responsible for selected model, transcript state, abort handling, and `models.stream()`.

**Tech Stack:** React 19, ProseMirror (`model`, `state`, `view`, `keymap`, `commands`, `history`), Vitest with jsdom.

**Spec:** `docs/superpowers/specs/2026-09-02-agent-prosemirror-composer-design.md`

## Global Constraints

- Add ProseMirror only to `@examples/agent-chat`; do not add Tiptap or a new Cordis plugin.
- The schema contains only `doc`, `paragraph`, and `text`; model requests remain plain-text `ChatMessage` values.
- Enter sends a nonblank document when not composing; Shift+Enter keeps ProseMirror's default paragraph insertion; disabled blocks edits and sends.
- Do not implement file references, complex-paste conversion, marks, slash commands, persistence, or a conversation runtime.
- Preserve the current selected-model and abort/Stop behavior.

---

### Task 1: Add the private ProseMirror composer module

**Files:**
- Modify: `examples/agent/plugins/chat/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `examples/agent/plugins/chat/src/chat-composer.tsx`
- Create: `examples/agent/plugins/chat/src/chat-composer.test.tsx`

**Interfaces:**
- Produces: `ChatComposer({ disabled, onSend, sendLabel }: { disabled: boolean; onSend: (text: string) => void; sendLabel: string })`.
- Produces: `serializeComposerText(doc: Node): string`, used only by composer tests to prove paragraph-to-newline conversion.
- Consumes: no Cordis Context and no model runtime.

- [ ] **Step 1: Write the failing composer tests**

```tsx
function setEditorText(editor: HTMLElement, text: string) {
  editor.textContent = text
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
}

it('serializes paragraphs and sends Enter only outside IME composition', async () => {
  const sent = vi.fn()
  const { editor } = await renderComposer({ onSend: sent, sendLabel: 'Send' })
  setEditorText(editor, 'first\nsecond')
  editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
  expect(sent).toHaveBeenCalledWith('first\nsecond')

  setEditorText(editor, '中文')
  editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, isComposing: true, key: 'Enter' }))
  expect(sent).toHaveBeenCalledTimes(1)
})

it('keeps Shift+Enter as an editable paragraph break and disables the editor', async () => {
  const { editor, rerender } = await renderComposer({ onSend: vi.fn(), sendLabel: 'Send' })
  editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', shiftKey: true }))
  expect(editor.getAttribute('contenteditable')).toBe('true')
  await rerender(<ChatComposer disabled onSend={vi.fn()} sendLabel="Send" />)
  expect(editor.getAttribute('contenteditable')).toBe('false')
})
```

Implement `renderComposer` in the test with `createRoot(container)` and `act()`; return `container.querySelector<HTMLElement>('[aria-label="Message"]')!` as `editor`, plus an async `rerender` that calls `root.render()` inside `act()`. In `afterEach`, unmount each created React root and remove its container.

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/chat/src/chat-composer.test.tsx`

Expected: FAIL because `chat-composer.tsx` and its exports do not exist.

- [ ] **Step 3: Add the minimum dependencies**

Add `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-keymap`, `prosemirror-commands`, and `prosemirror-history` as production dependencies of `@examples/agent-chat`. Run `pnpm install` so only its manifest and the lockfile record the resolved graph.

- [ ] **Step 4: Write the minimum implementation**

```tsx
export function ChatComposer({ disabled, onSend, sendLabel }: ChatComposerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const submitRef = useRef<() => void>(() => {})
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  useLayoutEffect(() => {
    const view = new EditorView(hostRef.current!, {
      state: EditorState.create({ schema, plugins: [history(), keymap({ Enter: sendCurrentDocument }), keymap(baseKeymap)] }),
      dispatchTransaction(transaction) { view.updateState(view.state.apply(transaction)) },
    })
    submitRef.current = () => sendCurrentDocument(view.state, view.dispatch, view)
    return () => view.destroy()
  }, [])

  return <form onSubmit={event => { event.preventDefault(); submitRef.current() }}>
    <div ref={hostRef} />
    <button disabled={disabled || !canSend} type="submit">{sendLabel}</button>
  </form>
}
```

Define `schema` with only `doc`, `paragraph`, and `text`. Configure the EditorView's editable DOM with `aria-label: 'Message'`. `sendCurrentDocument(state, dispatch, view)` returns `false` for Shift+Enter, IME composition, or `view.composing`; otherwise it serializes `state.doc`, returns `true` without dispatching for whitespace-only text, calls the latest `onSend`, dispatches a transaction replacing the document with one empty paragraph, and returns `true`. In `dispatchTransaction`, call `setCanSend(serializeComposerText(next.doc).trim() !== '')`; call `view.setProps({ editable: () => !disabled })` when `disabled` changes.

- [ ] **Step 5: Run the composer tests to verify they pass**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/chat/src/chat-composer.test.tsx`

Expected: PASS; paragraph serialization, Enter, Shift+Enter, IME composition, clearing after send, and disabled editing are covered.

- [ ] **Step 6: Commit the composer module**

```bash
git add examples/agent/plugins/chat/package.json pnpm-lock.yaml examples/agent/plugins/chat/src/chat-composer.tsx examples/agent/plugins/chat/src/chat-composer.test.tsx
git commit -m "feat(agent): add ProseMirror composer"
```

### Task 2: Connect the composer to the chat route and retain stream controls

**Files:**
- Modify: `examples/agent/plugins/chat/src/index.tsx`
- Modify: `examples/agent/plugins/chat/src/index.test.tsx`

**Interfaces:**
- Consumes: `ChatComposer` through `disabled={streaming}` and `onSend={send}`.
- Produces: the `/chat` route sends composer text through `models.stream({ abortSignal, messages, modelId })`.
- Preserves: page ownership of `selectedModelId`, transcript messages, `AbortController`, and Stop button state.

- [ ] **Step 1: Update the chat integration test first**

Replace textarea mutation with direct DOM input on the composer. Keep Qwen selection and assert:

```tsx
const editor = container.querySelector<HTMLElement>('[aria-label="Message"]')!
editor.textContent = 'Hi'
editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Hi', inputType: 'insertText' }))
await act(async () => await Promise.resolve())
```

```tsx
expect(stream).toHaveBeenCalledWith(expect.objectContaining({
  modelId: 'qwen-plus',
  messages: [expect.objectContaining({ content: 'Hi', role: 'user' })],
}))
expect(stream.mock.calls[0]![0].abortSignal?.aborted).toBe(true)
```

Also assert that the composer host is `contenteditable="false"` while streaming and returns to `"true"` after abort completes.

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/chat/src/index.test.tsx`

Expected: FAIL because the route still renders a textarea and has no composer host.

- [ ] **Step 3: Replace the textarea with `ChatComposer`**

```tsx
async function send(content: string) {
  if (controllerRef.current)
    return
  const userMessage: ChatMessage = { content, id: String(messageIdRef.current++), role: 'user' }
  const requestMessages = [...messages, userMessage]
  const controller = new AbortController()
  controllerRef.current = controller
  setMessages([...requestMessages, { content: '', id: String(messageIdRef.current++), role: 'assistant' }])
  setStreaming(true)
  try {
    for await (const chunk of models.stream({ abortSignal: controller.signal, messages: requestMessages, modelId: selectedModelId }))
      setMessages(current => appendAssistantText(current, chunk))
  }
  catch (error) {
    if (!controller.signal.aborted)
      setMessages(current => replaceAssistantText(current, `Error: ${error instanceof Error ? error.message : String(error)}`))
  }
  finally {
    if (controllerRef.current === controller) {
      controllerRef.current = undefined
      setStreaming(false)
    }
  }
}

<label>
  {t('chat.model')}
  <select aria-label={t('chat.model')} value={selectedModelId} onChange={event => setSelectedModelId(event.target.value)}>
    {models.snapshot().map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
  </select>
</label>
<ChatComposer disabled={streaming} onSend={content => void send(content)} sendLabel={t('chat.send')} />
```

Remove `input` React state, the old textarea, and form submit handler. Retain the message list, model selector, Stop button, abort cleanup, and error replacement behavior exactly as they are.

- [ ] **Step 4: Run the focused chat suite to verify it passes**

Run: `CI=true pnpm exec vitest run examples/agent/plugins/chat/src/chat-composer.test.tsx examples/agent/plugins/chat/src/index.test.tsx`

Expected: PASS; selected model, plain-text message transfer, stream abort, composer disabled state, keyboard behavior, and IME protection all pass.

- [ ] **Step 5: Run final scoped validation**

Run:

```bash
CI=true pnpm typecheck
CI=true pnpm --filter @examples/agent build
git diff --check
```

Expected: all commands exit 0. Do not treat unrelated recursive-worktree Vitest discovery failures as composer failures.

- [ ] **Step 6: Commit the route integration**

```bash
git add examples/agent/plugins/chat/src/index.tsx examples/agent/plugins/chat/src/index.test.tsx
git commit -m "feat(agent): use ProseMirror chat input"
```
