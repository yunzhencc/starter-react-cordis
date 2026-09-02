import decodeJxl from '@jsquash/jxl/decode';

export interface DecodeRequest {
  bytes: Uint8Array;
  id: string;
}

export interface DecodeSuccess {
  height: number;
  id: string;
  pixels: Uint8ClampedArray;
  width: number;
}

export interface DecodeFailure {
  error: string;
  id: string;
}

export type DecodeResponse = DecodeFailure | DecodeSuccess;

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
  postMessage: (message: DecodeResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = async ({ data: { bytes, id } }) => {
  try {
    const image = await decodeJxl(bytes.buffer as ArrayBuffer);
    const pixels = image.data;
    workerScope.postMessage({
      height: image.height,
      id,
      pixels,
      width: image.width,
    }, [pixels.buffer as ArrayBuffer]);
  }
  catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    });
  }
};
