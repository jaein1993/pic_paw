import type { CutFrames, CutLayout } from '@/shared/types';

// WebM uses larger dimensions than GIF — VP9 compresses well so file size
// stays small even at 2× the GIF strip. Source frames are 400×400 (Compose
// FRAME_SIZE), so 1×4 cells are 1.6× upscale (VP9 absorbs) and 2×2 cells
// downsample cleanly to ~375.
const STRIP_W = 768;
const HEADER_H = 138;
const GAP = 17;
const FOOTER_H = 40;
const CELL_1x4 = 640;
const PAD_X_2x2 = GAP;
const CELL_2x2 = (STRIP_W - 2 * PAD_X_2x2 - GAP) / 2;

const FPS = 8;
const FRAME_INTERVAL_MS = 1000 / FPS;

export interface WebmEncodeConfig {
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

function pickWebmMime(): string | null {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function encodeWebm(config: WebmEncodeConfig): Promise<Blob> {
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

  const mime = pickWebmMime();
  if (!mime) {
    throw new Error('이 브라우저는 WebM 녹화를 지원하지 않아요. (Safari는 GIF로 다운로드해주세요)');
  }

  const geom = geometryFor(layout);

  // Use the longest cut as the video length. Cuts with fewer frames freeze
  // on their last frame; empty cuts stay blank.
  const maxLen = cutFrames.reduce(
    (m, arr) => Math.max(m, arr.length),
    0,
  );
  if (maxLen === 0) {
    throw new Error('녹화된 프레임이 없습니다.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = STRIP_W;
  canvas.height = geom.stripH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context 사용 불가');

  // Static chrome (drawn once; cell contents drawn per-frame on top).
  if (outerBorder > 0) {
    ctx.fillStyle = outerBorderColor;
    ctx.fillRect(0, 0, STRIP_W, geom.stripH);
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      outerBorder,
      outerBorder,
      STRIP_W - 2 * outerBorder,
      geom.stripH - 2 * outerBorder,
    );
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, STRIP_W, geom.stripH);
  }

  ctx.fillStyle = inkColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${brandFontWeight} 55px ${brandFont}`;
  ctx.fillText(brandText, STRIP_W / 2, HEADER_H / 2 + 12);

  ctx.strokeStyle = innerBorderColor;
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const { x, y } = geom.cellOf(i);
    ctx.strokeRect(x - 2, y - 2, geom.cellW + 4, geom.cellH + 4);
  }

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  for (let frameIdx = 0; frameIdx < maxLen; frameIdx++) {
    for (let i = 0; i < 4; i++) {
      const arr = cutFrames[i];
      if (!arr || arr.length === 0) continue;
      const idx = Math.min(frameIdx, arr.length - 1);
      const { x, y } = geom.cellOf(i);
      ctx.drawImage(arr[idx], x, y, geom.cellW, geom.cellH);
    }
    onProgress?.((frameIdx + 1) / maxLen);
    await delay(FRAME_INTERVAL_MS);
  }

  // Hold the last frame for one extra interval so the encoder definitely
  // samples it before we stop the stream.
  await delay(FRAME_INTERVAL_MS);
  recorder.stop();
  await stopped;

  return new Blob(chunks, { type: mime });
}
