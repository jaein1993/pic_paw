import { removeBackground, type Config } from '@imgly/background-removal';

interface RemoveBackgroundOptions {
  onProgress?: (progress: number) => void;
}

export async function removeImageBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {}
): Promise<Blob> {
  const config: Config = {
    // Quantized int8 model — ~10MB instead of ~30MB. First-load data cost
    // and mobile RAM pressure both drop ~3x. Edge detail (fine fur) is
    // marginally less crisp, which is acceptable for the booth use case
    // and is the right trade-off for users on cellular.
    model: 'isnet_quint8',
    output: {
      format: 'image/png',
      quality: 1.0,
    },
    progress: (key: string, current: number, total: number) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      opts.onProgress?.(percent);
    },
  };

  return removeBackground(file, config);
}
