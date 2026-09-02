import { readPsd } from 'ag-psd';

const image = document.querySelector('img')!;
let sourceUrl: string | undefined;

addEventListener('message', ({ data }) => {
  if (data?.type !== 'gallery-plugin:asset' || !(data.bytes instanceof ArrayBuffer))
    return;
  try {
    const psd = readPsd(data.bytes, { skipLayerImageData: true, skipThumbnail: true, useImageData: true });
    if (!psd.imageData || psd.width * psd.height > 100_000_000)
      throw new Error('invalid PSD');
    const canvas = document.createElement('canvas');
    canvas.width = psd.width;
    canvas.height = psd.height;
    canvas.getContext('2d')?.putImageData(psd.imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob)
        return;
      if (sourceUrl)
        URL.revokeObjectURL(sourceUrl);
      sourceUrl = URL.createObjectURL(blob);
      image.src = sourceUrl;
      image.alt = data.name;
    }, 'image/webp', 0.82);
  }
  catch {
    image.removeAttribute('src');
  }
});

addEventListener('unload', () => {
  if (sourceUrl)
    URL.revokeObjectURL(sourceUrl);
});
