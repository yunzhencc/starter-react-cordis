import { readPsd } from 'ag-psd';

const MAX_PIXELS = 100_000_000;

globalThis.onmessage = async ({ data }: MessageEvent<{ bytes: ArrayBuffer; id: string; maxEdge: number }>) => {
  try {
    const psd = readPsd(data.bytes, { skipLayerImageData: true, skipThumbnail: true, useImageData: true });
    if (!psd.imageData || psd.width * psd.height > MAX_PIXELS)
      throw new Error('PSD dimensions exceed 100 megapixels');
    const scale = Math.min(1, data.maxEdge / Math.max(psd.width, psd.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(psd.width * scale)), Math.max(1, Math.round(psd.height * scale)));
    const source = new OffscreenCanvas(psd.width, psd.height);
    source.getContext('2d')?.putImageData(psd.imageData, 0, 0);
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    const bytes = await (await canvas.convertToBlob({ quality: 0.82, type: 'image/webp' })).arrayBuffer();
    globalThis.postMessage({ bytes, id: data.id, mimeType: 'image/webp' }, [bytes]);
  }
  catch (error) {
    globalThis.postMessage({ error: error instanceof Error ? error.message : 'PSD thumbnail failed', id: data.id });
  }
};
