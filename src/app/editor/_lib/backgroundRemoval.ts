import { removeBackground, type Config } from '@imgly/background-removal';

export type BackgroundRemovalStage = 'downloading' | 'processing';

interface RemoveBackgroundOptions {
  onStage?: (stage: BackgroundRemovalStage) => void;
  onProgress?: (percent: number) => void;
}

// The library reports progress with a `key` (e.g. "fetch:onnx-model",
// "compute:inference"). Each phase resets current/total to 0 internally,
// so we map keys into two coarse stages and stretch each stage into a
// fixed slice of the overall progress bar (monotonic, never decreasing).
const STAGE_WEIGHTS: Record<BackgroundRemovalStage, { start: number; span: number }> = {
  downloading: { start: 0, span: 70 },
  processing: { start: 70, span: 30 },
};

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
  let lastPercent = 0;

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
    progress: (key: string, current: number, total: number) => {
      const stage = stageFromKey(key);
      if (stage !== lastStage) {
        lastStage = stage;
        opts.onStage?.(stage);
      }
      const w = STAGE_WEIGHTS[stage];
      const stageRatio = total > 0 ? current / total : 0;
      const overall = Math.round(w.start + stageRatio * w.span);
      // monotonic — never let the bar move backward
      const next = Math.max(lastPercent, overall);
      if (next !== lastPercent) {
        lastPercent = next;
        opts.onProgress?.(next);
      }
    },
  };

  return removeBackground(file, config);
}
