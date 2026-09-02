// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis';
import * as formats from '@yunzhen/gallery-formats';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as jxl from './index';
import { createJxlThumbnail } from './index';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const workerHarness = vi.hoisted(() => {
  const workers: FakeWorker[] = [];

  class FakeWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      workers.push(this);
    }
  }

  return { FakeWorker, workers };
});

vi.mock('./decode-worker?worker', () => ({ default: workerHarness.FakeWorker }));

let canvases: HTMLCanvasElement[];

beforeEach(() => {
  vi.clearAllMocks();
  workerHarness.workers.length = 0;
  canvases = [];
  const context = {
    drawImage: vi.fn(),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return context;
  } as unknown as HTMLCanvasElement['getContext']);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob([new Uint8Array([1, 2, 3]).buffer], { type: 'image/webp' }));
  });
  vi.stubGlobal('ImageData', class ImageData {
    constructor(
      public data: Uint8ClampedArray<ArrayBuffer>,
      public width: number,
      public height: number,
    ) {}
  });
  let nextObjectUrl = 0;
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => `blob:jxl-${++nextObjectUrl}`) },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
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
  const result = createJxlThumbnail(new Uint8Array([0]));
  const worker = latestWorker();
  const assertion = expect(result).rejects.toThrow('invalid JXL');

  respondWithDecodeError(worker, 'invalid JXL');

  await assertion;
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates the worker after creating a 400px WebP thumbnail', async () => {
  const result = createJxlThumbnail(new Uint8Array([1]));
  const worker = latestWorker();

  respondWithImage(worker, 800, 400);

  const thumbnail = await result;
  expect(thumbnail.mimeType).toBe('image/webp');
  expect(canvases.at(-1)?.width).toBe(400);
  expect(canvases.at(-1)?.height).toBe(200);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates the worker when the Worker reports an error', async () => {
  const result = createJxlThumbnail(new Uint8Array([2]));
  const worker = latestWorker();
  const assertion = expect(result).rejects.toThrow('JXL worker crashed');

  worker.onerror?.({
    error: new Error('JXL worker crashed'),
    message: 'JXL worker crashed',
  } as ErrorEvent);

  await assertion;
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates the worker after the 30-second decode timeout', async () => {
  vi.useFakeTimers();
  const result = createJxlThumbnail(new Uint8Array([3]));
  const worker = latestWorker();
  const assertion = expect(result).rejects.toThrow('JXL decode timed out after 30 seconds');

  await vi.advanceTimersByTimeAsync(30_000);

  await assertion;
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('keeps the current viewer source when a replaced decode later rejects', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const Viewer = jxl.jxlExtension.Viewer;
  await act(async () => root.render(<Viewer name="old.jxl" source={new Uint8Array([4])} />));
  const oldWorker = latestWorker();
  await act(async () => root.render(<Viewer name="new.jxl" source={new Uint8Array([5])} />));
  const newWorker = latestWorker();

  await act(async () => {
    respondWithImage(newWorker, 2, 1);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  const image = container.querySelector<HTMLImageElement>('img')!;
  const currentSource = image.getAttribute('src');

  await act(async () => {
    respondWithDecodeError(oldWorker, 'stale JXL failure');
    await Promise.resolve();
  });

  expect(currentSource).toBe('blob:jxl-1');
  expect(image.getAttribute('src')).toBe(currentSource);
  await act(async () => root.unmount());
});

function latestWorker() {
  const worker = workerHarness.workers.at(-1);
  if (!worker)
    throw new Error('expected a Worker instance');
  return worker;
}

function postedRequest(worker: InstanceType<typeof workerHarness.FakeWorker>) {
  const request = worker.postMessage.mock.calls[0]?.[0] as { bytes: Uint8Array; id: string } | undefined;
  if (!request)
    throw new Error('expected a decode request');
  return request;
}

function respondWithDecodeError(worker: InstanceType<typeof workerHarness.FakeWorker>, error: string) {
  const { id } = postedRequest(worker);
  worker.onmessage?.({ data: { error, id } } as MessageEvent);
}

function respondWithImage(worker: InstanceType<typeof workerHarness.FakeWorker>, width: number, height: number) {
  const { id } = postedRequest(worker);
  const pixels = new Uint8ClampedArray(width * height * 4);
  worker.onmessage?.({ data: { height, id, pixels, width } } as MessageEvent);
}

async function createFormatContext() {
  const ctx = new Context();
  const fiber = ctx.plugin(formats);
  await fiber.await();
  return ctx;
}
