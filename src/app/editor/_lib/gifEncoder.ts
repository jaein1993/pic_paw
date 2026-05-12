import GIF from 'gif.js';
import type { CutFrames, CutLayout } from '@/shared/types';

// Strip layout — source frames are 400×400 (Compose FRAME_SIZE), so 1×4
// cells stay 1:1 and 2×2 cells downsample to 220 with minimal aliasing.
// Footer kept small (no meta text) just for visual breathing room.
const STRIP_W = 450;
const HEADER_H = 80;
const GAP = 10;
const FOOTER_H = 20;
const CELL_1x4 = 400;
const PAD_X_2x2 = GAP;
const CELL_2x2 = (STRIP_W - 2 * PAD_X_2x2 - GAP) / 2;

const FRAME_DELAY_MS = Math.round(1000 / 8);

export interface GifEncodeConfig {
  cutFrames: CutFrames[];
  layout: CutLayout;
  bgColor: string;
  inkColor: string;
  brandText: string;
  brandFont: string;
  brandFontWeight: string;
  outerBorder: number;
  outerBorderColor: string;
  innerBorderColor: string;
  onProgress?: (progress: number) => void;
}

interface Geometry {
  stripH: number;
  cellW: number;
  cellH: number;
  cellOf: (idx: number) => { x: number; y: number };
}

function geometryFor(layout: CutLayout): Geometry {
  if (layout === '2x2') {
    const cell = CELL_2x2;
    return {
      stripH: HEADER_H + 2 * cell + GAP + FOOTER_H,
      cellW: cell,
      cellH: cell,
      cellOf: (idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        return {
          x: PAD_X_2x2 + col * (cell + GAP),
          y: HEADER_H + row * (cell + GAP),
        };
      },
    };
  }
  const cell = CELL_1x4;
  const cellX = (STRIP_W - cell) / 2;
  return {
    stripH: HEADER_H + 4 * cell + 3 * GAP + FOOTER_H,
    cellW: cell,
    cellH: cell,
    cellOf: (idx) => ({ x: cellX, y: HEADER_H + idx * (cell + GAP) }),
  };
}

export function encodeGif(config: GifEncodeConfig): Promise<Blob> {
  const {
    cutFrames,
    layout,
    bgColor,
    inkColor,
    brandText,
    brandFont,
    brandFontWeight,
    outerBorder,
    outerBorderColor,
    innerBorderColor,
    onProgress,
  } = config;

  const geom = geometryFor(layout);

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

  // Pre-render the static chrome (background, border, header, cell outlines)
  // once and clone it per frame.
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = STRIP_W;
  baseCanvas.height = geom.stripH;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return Promise.reject(new Error('canvas 2d context 사용 불가'));

  if (outerBorder > 0) {
    baseCtx.fillStyle = outerBorderColor;
    baseCtx.fillRect(0, 0, STRIP_W, geom.stripH);
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(
      outerBorder,
      outerBorder,
      STRIP_W - 2 * outerBorder,
      geom.stripH - 2 * outerBorder,
    );
  } else {
    baseCtx.fillStyle = bgColor;
    baseCtx.fillRect(0, 0, STRIP_W, geom.stripH);
  }

  baseCtx.fillStyle = inkColor;
  baseCtx.textAlign = 'center';
  baseCtx.textBaseline = 'middle';
  baseCtx.font = `${brandFontWeight} 32px ${brandFont}`;
  baseCtx.fillText(brandText, STRIP_W / 2, HEADER_H / 2 + 8);

  baseCtx.strokeStyle = innerBorderColor;
  baseCtx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const { x, y } = geom.cellOf(i);
    baseCtx.strokeRect(x - 1, y - 1, geom.cellW + 2, geom.cellH + 2);
  }

  const gif = new GIF({
    workers: 2,
    quality: 5,
    workerScript: '/gif.worker.js',
    width: STRIP_W,
    height: geom.stripH,
    repeat: 0,
    dither: 'FloydSteinberg',
  });

  for (let frameIdx = 0; frameIdx < maxLen; frameIdx++) {
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = STRIP_W;
    frameCanvas.height = geom.stripH;
    const fctx = frameCanvas.getContext('2d');
    if (!fctx) continue;
    fctx.drawImage(baseCanvas, 0, 0);

    for (let i = 0; i < 4; i++) {
      const arr = cutFrames[i];
      if (!arr || arr.length === 0) continue;
      const idx = Math.min(frameIdx, arr.length - 1);
      const { x, y } = geom.cellOf(i);
      fctx.drawImage(arr[idx], x, y, geom.cellW, geom.cellH);
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
