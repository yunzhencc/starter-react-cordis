// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import type { ModelStreamRequest } from '../../models/src';
import { Context } from '@deepseek-ai/cordis';
import * as i18n from '@yunzhen/cordis-ui-i18n';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as chat from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function bootChat() {
  window.history.replaceState({}, '', '/chat');
  const stream = vi.fn(async function* ({ abortSignal, modelId }: ModelStreamRequest) {
    expect(abortSignal?.aborted).toBe(false);
    yield `${modelId}: first`;
    await new Promise(resolve => abortSignal?.addEventListener('abort', resolve, { once: true }));
  });
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];

  for (const module of [
    i18n,
    renderer,
    router,
    layout,
    {
      apply(pluginCtx: Context) {
        pluginCtx.reflect.provide('models', {
          defaultModelId: 'deepseek-chat',
          snapshot: () => [
            { baseURL: '', id: 'deepseek-chat', label: 'DeepSeek Chat', model: '', provider: 'deepseek' },
            { baseURL: '', id: 'qwen-plus', label: 'Qwen Plus', model: '', provider: 'qwen' },
          ],
          stream,
        } as never);
      },
    },
    chat,
  ]) {
    const fiber = ctx.plugin(module);
    fibers.push(fiber);
    await fiber.await();
  }

  return {
    container: document.createElement('div'),
    ctx,
    stream,
    async dispose() {
      for (const fiber of fibers.reverse()) await fiber.dispose();
    },
  };
}

describe('agent chat module', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      addEventListener() {},
      matches: false,
      removeEventListener() {},
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends using the selected model and stops the active stream', async () => {
    const { container, ctx, dispose, stream } = await bootChat();
    let unmount!: () => void;

    await act(async () => {
      unmount = ctx.uiRenderer.mount(container);
    });

    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('[aria-label="Model"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'qwen-plus');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const message = container.querySelector<HTMLTextAreaElement>('[aria-label="Message"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(message, 'Hi');
      message.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await vi.waitFor(() => {
      expect(stream).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'qwen-plus' }));
      expect(container.textContent).toContain('qwen-plus: first');
    });

    await act(async () => {
      (container.querySelector('button[type="button"]') as HTMLButtonElement).click();
    });

    expect(stream.mock.calls[0]![0].abortSignal?.aborted).toBe(true);
    await act(async () => unmount());
    await dispose();
  });
});
