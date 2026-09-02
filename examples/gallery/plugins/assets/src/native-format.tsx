import type { FormatExtension } from '@yunzhen/gallery-formats';
import { useEffect, useMemo } from 'react';

const MAX_THUMBNAIL_EDGE = 400;

export const nativeFormat: FormatExtension = {
  id: 'native',
  version: '1',
  extensions: ['.png', '.jpg', '.jpeg', '.webp'],
  async createThumbnail(source) {
    const sourceUrl = URL.createObjectURL(new Blob([toArrayBuffer(source)]));
    try {
      const image = await loadImage(sourceUrl);
      const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longestEdge)
        throw new Error('image has no dimensions');

      const scale = Math.min(1, MAX_THUMBNAIL_EDGE / longestEdge);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context)
        throw new Error('canvas is unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const thumbnail = await canvasToBlob(canvas);
      return {
        bytes: new Uint8Array(await thumbnail.arrayBuffer()),
        mimeType: 'image/webp',
      };
    }
    finally {
      URL.revokeObjectURL(sourceUrl);
    }
  },
  Viewer: NativeViewer,
};

// The extension contract requires its Viewer to live beside the format implementation.
// eslint-disable-next-line react-refresh/only-export-components
function NativeViewer({ name, source }: { name: string; source: Uint8Array }) {
  const sourceUrl = useMemo(
    () => URL.createObjectURL(new Blob([toArrayBuffer(source)], { type: mimeTypeForName(name) })),
    [name, source],
  );
  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);
  return <img alt={name} src={sourceUrl} />;
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = sourceUrl;
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

function mimeTypeForName(name: string) {
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (extension === '.png')
    return 'image/png';
  if (extension === '.webp')
    return 'image/webp';
  return 'image/jpeg';
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}
