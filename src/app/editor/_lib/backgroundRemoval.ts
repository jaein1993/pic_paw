import { removeBackground, type Config } from '@imgly/background-removal';

export type BackgroundRemovalStage = 'downloading' | 'processing';

interface RemoveBackgroundOptions {
  onStage?: (stage: BackgroundRemovalStage) => void;
}

// The library reports progress with a `key` (e.g. "fetch:onnx-model",
// "compute:inference"). We don't show a numeric % to the user because each
// internal phase resets current/total to 0 and the bar jitters confusingly.
// Instead we collapse the keys into two coarse stages and only emit when
// the stage actually changes.
function stageFromKey(key: string): BackgroundRemovalStage {
  const k = key.toLowerCase();
  if (k.includes('fetch') || k.includes('download') || k.includes('load') || k.includes('model')) {
    return 'downloading';
  }
  return 'processing';
}

export async function removeImageBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {}
): Promise<Blob> {
  let lastStage: BackgroundRemovalStage | null = null;

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
    progress: (key: string) => {
      const stage = stageFromKey(key);
      if (stage !== lastStage) {
        lastStage = stage;
        opts.onStage?.(stage);
      }
    },
  };

  return removeBackground(file, config);
}
