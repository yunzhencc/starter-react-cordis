// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis';
import decodeJxl from '@jsquash/jxl/decode';
import * as formats from '@yunzhen/gallery-formats';
import { expect, it, vi } from 'vitest';
import * as jxl from './index';
import { createJxlThumbnail } from './index';

const { terminateWorker } = vi.hoisted(() => ({
  terminateWorker: vi.fn(),
}));

vi.mock('@jsquash/jxl/decode', () => ({ default: vi.fn() }));

vi.mock('./decode-worker?worker', async () => {
  const { default: decodeJxl } = await import('@jsquash/jxl/decode');
  return {
    default: class DecodeWorker {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      postMessage({ bytes, id }: { bytes: Uint8Array; id: string }) {
        void decodeJxl(bytes.buffer as ArrayBuffer).then(
          ({ data, height, width }: ImageData) => this.onmessage?.({
            data: { height, id, pixels: data, width },
          } as MessageEvent),
          (error: unknown) => this.onmessage?.({
            data: { error: error instanceof Error ? error.message : String(error), id },
          } as MessageEvent),
        );
      }

      terminate() {
        terminateWorker();
      }
    },
  };
});

it('registers JXL without changing native format ownership', async () => {
  const ctx = await createFormatContext();
  const fiber = ctx.plugin(jxl);
  await fiber.await();
  expect(ctx.formats.find('.jxl')?.id).toBe('jxl');
  expect(ctx.formats.find('.png')).toBeUndefined();
  await fiber.dispose();
  expect(ctx.formats.find('.jxl')).toBeUndefined();
});

it('turns a decoder rejection into a thumbnail failure', async () => {
  vi.mocked(decodeJxl).mockRejectedValueOnce(new Error('invalid JXL'));
  await expect(createJxlThumbnail(new Uint8Array([0]))).rejects.toThrow('invalid JXL');
  expect(terminateWorker).toHaveBeenCalledOnce();
});

async function createFormatContext() {
  const ctx = new Context();
  const fiber = ctx.plugin(formats);
  await fiber.await();
  return ctx;
}
