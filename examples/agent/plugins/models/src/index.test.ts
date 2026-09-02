import { Context } from '@deepseek-ai/cordis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apply, inject } from './index';

const config = {
  defaultModel: 'deepseek-chat',
  models: [{
    apiKey: 'test-key',
    baseURL: 'https://api.deepseek.com/v1',
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    model: 'deepseek-chat',
    provider: 'deepseek',
  }],
};

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
      modelId: 'deepseek-chat',
    }))).resolves.toEqual(['Hello']);

    expect(ctx.models.defaultModelId).toBe('deepseek-chat');
    expect(ctx.models.snapshot()).toEqual([{
      baseURL: 'https://api.deepseek.com/v1',
      id: 'deepseek-chat',
      label: 'DeepSeek Chat',
      model: 'deepseek-chat',
      provider: 'deepseek',
    }]);
    expect(requests).toHaveLength(1);
    const [input, init] = requests[0]!;
    expect(String(input)).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'deepseek-chat' });

    await dispose();
  });

  it('rejects invalid configuration and unknown model IDs before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { ctx, dispose } = await boot();
    await expect(collect(ctx.models.stream({ messages: [], modelId: 'missing' })))
      .rejects
      .toThrow('unknown model: missing');
    expect(fetchMock).not.toHaveBeenCalled();
    await dispose();

    const invalidCtx = new Context();
    const invalidFiber = invalidCtx.plugin({ apply, inject }, {
      ...config,
      defaultModel: 'missing',
    });
    await expect(invalidFiber.await()).rejects.toThrow('default model is not configured: missing');
    await invalidFiber.dispose();
  });
});
