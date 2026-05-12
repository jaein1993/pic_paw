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
    // fp16 model (~45MB). Earlier reverted to quint8 on 2026-05-09 because
    // the edge-detail gain wasn't visible at smaller cell sizes. PNG 1×4
    // cells now export at 960×960 (3× pixelRatio), so retry fp16 here —
    // if the gain is still not visible, roll back.
    model: 'isnet_fp16',
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
