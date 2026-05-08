import type { CutFrames } from '@/shared/types';
import {
  GIF_STRIP_W as STRIP_W,
  GIF_STRIP_H as STRIP_H,
  GIF_HEADER_H as HEADER_H,
  GIF_CELL_W as CELL_W,
  GIF_CELL_H as CELL_H,
  GIF_CELL_X as CELL_X,
  GIF_GAP as GAP,
  GIF_FOOTER_H as FOOTER_H,
} from './gifEncoder';

const FPS = 8;
const FRAME_INTERVAL_MS = 1000 / FPS;

export interface WebmEncodeConfig {
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

  const mime = pickWebmMime();
  if (!mime) {
    throw new Error('이 브라우저는 WebM 녹화를 지원하지 않아요. (Safari는 GIF로 다운로드해주세요)');
  }

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
  canvas.height = STRIP_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context 사용 불가');

  // Static chrome (drawn once; cell contents drawn per-frame on top).
  if (outerBorder > 0) {
    ctx.fillStyle = outerBorderColor;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      outerBorder,
      outerBorder,
      STRIP_W - 2 * outerBorder,
      STRIP_H - 2 * outerBorder,
    );
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);
  }

  ctx.fillStyle = inkColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${brandFontWeight} 18px ${brandFont}`;
  ctx.fillText(brandText, STRIP_W / 2, HEADER_H / 2 + 4);

  ctx.strokeStyle = innerBorderColor;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const cellY = HEADER_H + i * (CELL_H + GAP);
    ctx.strokeRect(CELL_X - 1, cellY - 1, CELL_W + 2, CELL_H + 2);
  }

  ctx.fillStyle = metaColor;
  ctx.font = `8px ${metaFont}`;
  ctx.fillText(metaText, STRIP_W / 2, STRIP_H - FOOTER_H / 2 - 4);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime });
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
      const cellY = HEADER_H + i * (CELL_H + GAP);
      const arr = cutFrames[i];
      if (!arr || arr.length === 0) continue;
      const idx = Math.min(frameIdx, arr.length - 1);
      ctx.drawImage(arr[idx], CELL_X, cellY, CELL_W, CELL_H);
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
