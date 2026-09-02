// @vitest-environment jsdom

import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { Context } from '@deepseek-ai/cordis';
import * as i18n from '@yunzhen/cordis-ui-i18n';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './chat-composer';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function renderComposer(props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const ctx = new Context();
  const fibers: ReturnType<CordisContext['plugin']>[] = [];
  for (const module of [i18n, renderer]) {
    const fiber = ctx.plugin(module);
    fibers.push(fiber);
    await fiber.await();
  }
  const container = document.createElement('div');
  const remove = ctx.slots.register({ name: 'root' }, () => <ChatComposer disabled={false} onSend={vi.fn()} sendLabel="Send" {...props} />);
  let unmount!: () => void;
  await act(async () => {
    unmount = ctx.uiRenderer.mount(container);
  });
  cleanups.push(async () => {
    await act(async () => unmount());
    remove();
    for (const fiber of fibers.reverse()) await fiber.dispose();
  });
  return {
    editor: container.querySelector<HTMLElement>('[aria-label="Message"]')!,
  };
}

async function setEditorText(editor: HTMLElement, text: string) {
  await act(async () => {
    editor.replaceChildren(...text.split('\n').map((content) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = content;
      return paragraph;
    }));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('chatComposer', () => {
  it('sends plain text on Enter and clears the document', async () => {
    const onSend = vi.fn();
    const { editor } = await renderComposer({ onSend });
    await setEditorText(editor, 'first\nsecond');

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(onSend).toHaveBeenCalledWith('first\nsecond');
    expect(editor.textContent).toBe('');
  });

  it('does not send while composing or when Shift+Enter inserts a paragraph', async () => {
    const onSend = vi.fn();
    const { editor } = await renderComposer({ onSend });
    await setEditorText(editor, '中文');

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, isComposing: true, key: 'Enter' }));
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', shiftKey: true }));
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(editor.textContent).toContain('中文');
  });

  it('disables editing and sending while the chat is streaming', async () => {
    const onSend = vi.fn();
    const { editor } = await renderComposer({ disabled: true, onSend });

    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect((editor.closest('form')?.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
