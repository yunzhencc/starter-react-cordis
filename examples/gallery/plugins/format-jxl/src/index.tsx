import type { Context } from '@deepseek-ai/cordis';
import type { FormatExtension, Thumbnail } from '@yunzhen/gallery-formats';
import type { DecodeResponse } from './decode-worker';
import { useEffect, useRef } from 'react';
import DecodeWorker from './decode-worker?worker';

const DECODE_TIMEOUT_MS = 30_000;
const MAX_THUMBNAIL_EDGE = 400;
let nextDecodeId = 0;

export const inject = ['formats'];

export const jxlExtension: FormatExtension = {
  id: 'jxl',
  version: '1.0.0',
  extensions: ['.jxl'],
  createThumbnail: createJxlThumbnail,
  Viewer: JxlViewer,
};

export function apply(ctx: Context) {
  ctx.effect(() => ctx.formats.register(jxlExtension), 'gallery.format-jxl.register()');
}

export async function createJxlThumbnail(source: Uint8Array): Promise<Thumbnail> {
  const image = await decodeInWorker(source);
  const longestEdge = Math.max(image.width, image.height);
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0)
    throw new Error('decoded JXL has invalid dimensions');

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext)
    throw new Error('canvas is unavailable');
  const pixels = new Uint8ClampedArray(new ArrayBuffer(image.pixels.byteLength));
  pixels.set(image.pixels);
  sourceContext.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);

  const scale = Math.min(1, MAX_THUMBNAIL_EDGE / longestEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('canvas is unavailable');
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  const thumbnail = await canvasToBlob(canvas);
  return {
    bytes: new Uint8Array(await thumbnail.arrayBuffer()),
    mimeType: 'image/webp',
  };
}

// The extension contract requires its Viewer to live beside the format implementation.
// eslint-disable-next-line react-refresh/only-export-components
function JxlViewer({ name, source }: { name: string; source: Uint8Array }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let disposed = false;
    let sourceUrl: string | undefined;
    const image = imageRef.current;
    void createJxlThumbnail(source).then((thumbnail) => {
      if (disposed)
        return;
      sourceUrl = URL.createObjectURL(new Blob([toArrayBuffer(thumbnail.bytes)], { type: thumbnail.mimeType }));
      if (image)
        image.src = sourceUrl;
    }).catch(() => {
      image?.removeAttribute('src');
    });
    return () => {
      disposed = true;
      image?.removeAttribute('src');
      if (sourceUrl)
        URL.revokeObjectURL(sourceUrl);
    };
  }, [source]);
  return <img ref={imageRef} alt={name} />;
}

function decodeInWorker(source: Uint8Array) {
  const id = `jxl-${++nextDecodeId}`;
  const worker = new DecodeWorker();
  return new Promise<DecodedImage>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const settle = (callback: () => void) => {
      if (settled)
        return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      callback();
    };
    timeout = setTimeout(() => {
      settle(() => reject(new Error('JXL decode timed out after 30 seconds')));
    }, DECODE_TIMEOUT_MS);
    worker.onmessage = ({ data }: MessageEvent<DecodeResponse>) => {
      if (data.id !== id)
        return;
      if ('error' in data) {
        settle(() => reject(new Error(data.error)));
        return;
      }
      settle(() => resolve(data));
    };
    worker.onerror = (event) => {
      settle(() => reject(event.error instanceof Error
        ? event.error
        : new Error(event.message || 'JXL decoder worker failed')));
    };

    const bytes = Uint8Array.from(source);
    try {
      worker.postMessage({ bytes, id }, [bytes.buffer]);
    }
    catch (error) {
      settle(() => reject(error));
    }
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob)
        resolve(blob);
      else
        reject(new Error('thumbnail encode failed'));
    }, 'image/webp', 0.82);
  });
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

interface DecodedImage {
  height: number;
  pixels: Uint8ClampedArray;
  width: number;
}
