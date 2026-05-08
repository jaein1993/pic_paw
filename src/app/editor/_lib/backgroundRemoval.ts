import { removeBackground, type Config } from '@imgly/background-removal';

interface RemoveBackgroundOptions {
  onProgress?: (progress: number) => void;
}

export async function removeImageBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {}
): Promise<Blob> {
  const config: Config = {
    // fp16 — half-precision model (~45MB). Trades larger first-load and
    // higher RAM for noticeably crisper edge detail (especially fine fur),
    // which matters for pet cutouts where the subject IS fur. Inference
    // is single-shot per upload so the larger model doesn't impact booth
    // (camera/hand-tracking) performance.
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
