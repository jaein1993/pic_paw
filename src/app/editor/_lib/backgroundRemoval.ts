import { removeBackground, type Config } from '@imgly/background-removal';

interface RemoveBackgroundOptions {
  onProgress?: (progress: number) => void;
}

export async function removeImageBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {}
): Promise<Blob> {
  const config: Config = {
    // Quantized int8 model — ~10MB instead of ~45MB (fp16). Tried fp16 on
    // 2026-05-09 but the edge-detail improvement on pet fur was not
    // visually noticeable at our cell size while inference was clearly
    // slower, so reverted. quint8 stays the right trade-off here.
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
