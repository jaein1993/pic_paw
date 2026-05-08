import GIF from 'gif.js';
import type { CutFrames } from '@/shared/types';

// Animated strip layout — 1.25× the static PNG strip proportions. Source
// frames are 1080×1080 so the 400 cell downsamples cleanly. Going larger
// is bounded by GIF file-size budget (256-color palette is heavy).
export const GIF_STRIP_W = 450;
export const GIF_HEADER_H = 80;
export const GIF_CELL_W = 400;
export const GIF_CELL_H = 400;
export const GIF_CELL_X = (GIF_STRIP_W - GIF_CELL_W) / 2;
export const GIF_GAP = 10;
export const GIF_FOOTER_H = 70;
export const GIF_STRIP_H =
  GIF_HEADER_H + 4 * GIF_CELL_H + 3 * GIF_GAP + GIF_FOOTER_H;

const FRAME_DELAY_MS = Math.round(1000 / 8);

export interface GifEncodeConfig {
  cutFrames: CutFrames[];
  bgColor: string;
  inkColor: string;
  metaColor: string;
  brandText: string;
  brandFont: string;
  brandFontWeight: string;
  metaFont: string;
  outerBorder: number;
  outerBorderColor: string;
  innerBorderColor: string;
  metaText: string;
  onProgress?: (progress: number) => void;
}

export function encodeGif(config: GifEncodeConfig): Promise<Blob> {
  const {
    cutFrames,
    bgColor,
    inkColor,
    metaColor,
    brandText,
    brandFont,
    brandFontWeight,
    metaFont,
    outerBorder,
    outerBorderColor,
    innerBorderColor,
    metaText,
    onProgress,
  } = config;

  // Use the longest cut as the GIF length. Cuts with fewer frames freeze on
  // their last frame; empty cuts stay blank. This way a partial booth (2 of
  // 4 cuts) still renders.
  const maxLen = cutFrames.reduce(
    (m, arr) => Math.max(m, arr.length),
    0,
  );
  if (maxLen === 0) {
    return Promise.reject(new Error('녹화된 프레임이 없습니다.'));
  }

  // Pre-render the static chrome (background, border, header, footer, cell
  // outlines) once and clone it per frame.
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = GIF_STRIP_W;
  baseCanvas.height = GIF_STRIP_H;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return Promise.reject(new Error('canvas 2d context 사용 불가'));

  if (outerBorder > 0) {
    baseCtx.fillStyle = outerBorderColor;
    baseCtx.fillRect(0, 0, GIF_STRIP_W, GIF_STRIP_H);
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(
      outerBorder,
      outerBorder,
      GIF_STRIP_W - 2 * outerBorder,
      GIF_STRIP_H - 2 * outerBorder,
    );
  } else {
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(0, 0, GIF_STRIP_W, GIF_STRIP_H);
  }

  baseCtx.fillStyle = inkColor;
  baseCtx.textAlign = 'center';
  baseCtx.textBaseline = 'middle';
  baseCtx.font = `${brandFontWeight} 32px ${brandFont}`;
  baseCtx.fillText(brandText, GIF_STRIP_W / 2, GIF_HEADER_H / 2 + 8);

  baseCtx.strokeStyle = innerBorderColor;
  baseCtx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const cellY = GIF_HEADER_H + i * (GIF_CELL_H + GIF_GAP);
    baseCtx.strokeRect(GIF_CELL_X - 1, cellY - 1, GIF_CELL_W + 2, GIF_CELL_H + 2);
  }

  baseCtx.fillStyle = metaColor;
  baseCtx.font = `14px ${metaFont}`;
  baseCtx.fillText(
    metaText,
    GIF_STRIP_W / 2,
    GIF_STRIP_H - GIF_FOOTER_H / 2 - 8,
  );

  const gif = new GIF({
    workers: 2,
    quality: 5,
    workerScript: '/gif.worker.js',
    width: GIF_STRIP_W,
    height: GIF_STRIP_H,
    repeat: 0,
    dither: 'FloydSteinberg',
  });

  for (let frameIdx = 0; frameIdx < maxLen; frameIdx++) {
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = GIF_STRIP_W;
    frameCanvas.height = GIF_STRIP_H;
    const fctx = frameCanvas.getContext('2d');
    if (!fctx) continue;
    fctx.drawImage(baseCanvas, 0, 0);

    for (let i = 0; i < 4; i++) {
      const cellY = GIF_HEADER_H + i * (GIF_CELL_H + GIF_GAP);
      const arr = cutFrames[i];
      if (!arr || arr.length === 0) continue;
      const idx = Math.min(frameIdx, arr.length - 1);
      fctx.drawImage(arr[idx], GIF_CELL_X, cellY, GIF_CELL_W, GIF_CELL_H);
    }

    gif.addFrame(frameCanvas, { delay: FRAME_DELAY_MS, copy: true });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on('progress', (p) => {
      onProgress?.(p);
    });
    gif.on('finished', (blob) => {
      resolve(blob);
    });
    gif.on('abort', () => reject(new Error('GIF 인코딩이 취소되었습니다.')));
    gif.render();
  });
}
