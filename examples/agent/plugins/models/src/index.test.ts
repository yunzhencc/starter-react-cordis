// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, inject } from './index';

const config = { apiKey: 'test-key' };

beforeEach(() => localStorage.clear());

afterEach(() => vi.unstubAllGlobals());

async function boot(configValue = config) {
  const ctx = new Context();
  const fiber = ctx.plugin({ apply, inject }, configValue);
  await fiber.await();
  return {
    ctx,
    dispose: () => fiber.dispose(),
  };
}

async function collect(stream: AsyncIterable<string>) {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('agent models module', () => {
  it('streams an OpenAI-compatible response without exposing its credential', async () => {
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push([input, init]);
      return new Response([
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":0,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n',
      ].join(''), { headers: { 'content-type': 'text/event-stream' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { ctx, dispose } = await boot();
    await expect(collect(ctx.models.stream({
      messages: [{ content: 'Hi', role: 'user' }],
    }))).resolves.toEqual(['Hello']);

    expect(requests).toHaveLength(1);
    const [input, init] = requests[0]!;
    expect(String(input)).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'deepseek-chat' });

    await dispose();
  });

  it('rejects non-DeepSeek model configuration before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const invalidCtx = new Context();
    const invalidFiber = invalidCtx.plugin({ apply, inject }, {
      ...config,
      provider: 'other',
    });
    await expect(invalidFiber.await()).rejects.toThrow('models config only supports apiKey');
    await invalidFiber.dispose();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists the DeepSeek API key without accepting another provider configuration', async () => {
    const updated = {
      apiKey: 'saved-key',
    };
    const { ctx, dispose } = await boot();

    ctx.models.update(updated);
    await dispose();

    const { ctx: restored, dispose: disposeRestored } = await boot();
    expect(restored.models.settings()).toEqual(updated);
    await disposeRestored();
  });
});
