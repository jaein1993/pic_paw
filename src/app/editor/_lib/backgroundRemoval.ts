import { removeBackground, type Config } from '@imgly/background-removal';

interface RemoveBackgroundOptions {
  onProgress?: (progress: number) => void;
}

export async function removeImageBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {}
): Promise<Blob> {
  const config: Config = {
    // FP16 model — better edge accuracy (fur/ears/collars) than the quantized
    // default while keeping load time and CPU cost reasonable.
    model: 'isnet_fp16',
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
