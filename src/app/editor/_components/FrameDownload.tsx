'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import type { CutLayout, FrameColor } from '@/shared/types';
import {
  downloadBlob,
  downloadDataURL,
  shareDataURL,
} from '@/app/editor/_lib/download';
import { encodeGif } from '@/app/editor/_lib/gifEncoder';
import { encodeWebm } from '@/app/editor/_lib/webmEncoder';
import { Button } from '@/shared/components/ui/Button';
import { SPEECH_BUBBLE_ASPECT } from './decorations';

const STRIP_W = 360;
const HEADER_H = 64;
const GAP = 8;
const FOOTER_H = 16;
const CELL_1x4 = 320;
const CELL_2x2 = (STRIP_W - GAP) / 2;
const PET_REL = 0.55;

interface FrameStyle {
  bg: string;
  ink: string;
  brandText: string;
  brandFont: string;
  brandFontStyle: string;
  innerBorderColor: string;
  outerBorder: number;
  outerBorderColor: string;
  containerClass: string;
}

function frameStyleFor(color: FrameColor): FrameStyle {
  if (color === 'white') {
    return {
      bg: '#F4EFE6',
      ink: '#1A1714',
      brandText: 'Pic-paw',
      brandFont: 'Nanum Myeongjo, serif',
      brandFontStyle: 'bold',
      innerBorderColor: '#1A1714',
      outerBorder: 2,
      outerBorderColor: '#1A1714',
      containerClass: 'shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)]',
    };
  }
  return {
    bg: '#1A1714',
    ink: '#F4EFE6',
    brandText: 'Pic-paw',
    brandFont: 'Nanum Myeongjo, serif',
    brandFontStyle: 'bold',
    innerBorderColor: '#F4EFE6',
    outerBorder: 0,
    outerBorderColor: '#1A1714',
    containerClass: 'shadow-[0_12px_30px_-10px_rgba(0,0,0,0.35)]',
  };
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
          x: col * (cell + GAP),
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

export function FrameDownload() {
  const {
    petImageUrl,
    shots,
    cutFrames,
    setStep,
    speechText,
    cutLayout,
    setCutLayout,
    frameColor,
    setFrameColor,
  } = useEditorState();
  const frame = useMemo(() => frameStyleFor(frameColor), [frameColor]);
  const geom = useMemo(() => geometryFor(cutLayout), [cutLayout]);

  const stageRef = useRef<Konva.Stage>(null);
  const stripContainerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(STRIP_W);

  // Track both the strip container width AND viewport height so the strip
  // fits without scrolling on portrait phones. Pick the smaller of:
  //   • container width
  //   • viewport-height-derived width (so strip never exceeds ~70vh tall)
  //   • original STRIP_W (no upscaling)
  useEffect(() => {
    const el = stripContainerRef.current;
    if (!el) return;
    const update = () => {
      const widthCap = el.offsetWidth;
      const viewportHeightCap =
        (window.innerHeight * 0.7) * (STRIP_W / geom.stripH);
      setDisplayWidth(Math.min(STRIP_W, widthCap, viewportHeightCap));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [geom.stripH]);

  // The container is `box-sizing: border-box`, so its border eats into the
  // content area. We size the Stage to the *inner* content area and grow
  // the outer container to fit.
  const borderPx = frame.outerBorder ?? 0;
  const innerWidth = Math.max(0, displayWidth - borderPx * 2);
  const innerHeight = innerWidth * (geom.stripH / STRIP_W);
  const displayHeight = innerHeight + borderPx * 2;
  const displayScale = innerWidth / STRIP_W;

  const slot0Url = shots[0]?.dataUrl ?? '';
  const slot1Url = shots[1]?.dataUrl ?? '';
  const slot2Url = shots[2]?.dataUrl ?? '';
  const slot3Url = shots[3]?.dataUrl ?? '';
  const [shot0] = useImage(slot0Url);
  const [shot1] = useImage(slot1Url);
  const [shot2] = useImage(slot2Url);
  const [shot3] = useImage(slot3Url);
  const [petImage] = useImage(petImageUrl ?? '');
  const shotImages = [shot0, shot1, shot2, shot3];

  const [shareResult, setShareResult] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [encoding, setEncoding] = useState<null | 'gif' | 'webm'>(null);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // Export the strip at 3× the design-canvas width so a downscaled-on-mobile
  // preview still produces a sharp PNG. Cell pixel resolution after export
  // is (3 × CELL_W) — 960 for 1×4, ~528 for 2×2.
  const exportPixelRatio = (3 * STRIP_W) / Math.max(innerWidth, 1);

  const handleDownload = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: exportPixelRatio });
    await downloadDataURL(dataUrl, `pic-paw_${Date.now()}.png`);
  }, [exportPixelRatio]);

  const handleShare = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: exportPixelRatio });
    const shared = await shareDataURL(dataUrl, 'pic-paw.png');
    setShareResult(shared ? 'shared' : 'copied');
    setTimeout(() => setShareResult('idle'), 2000);
  }, [exportPixelRatio]);

  const haveAnimatedFrames =
    cutFrames.length === 4 && cutFrames.every((arr) => arr.length > 0);

  const handleDownloadGif = useCallback(async () => {
    if (encoding) return;
    setEncoding('gif');
    setEncodeProgress(0);
    setEncodeError(null);
    try {
      const blob = await encodeGif({
        cutFrames,
        layout: cutLayout,
        bgColor: frame.bg,
        inkColor: frame.ink,
        brandText: frame.brandText,
        brandFont: frame.brandFont,
        brandFontWeight: frame.brandFontStyle,
        outerBorder: frame.outerBorder,
        outerBorderColor: frame.outerBorderColor,
        innerBorderColor: frame.innerBorderColor,
        onProgress: (p) => setEncodeProgress(p),
      });
      await downloadBlob(blob, `pic-paw_${Date.now()}.gif`, 'image/gif');
    } catch (err) {
      setEncodeError(err instanceof Error ? err.message : 'GIF 생성 실패');
    } finally {
      setEncoding(null);
      setEncodeProgress(0);
    }
  }, [cutFrames, cutLayout, encoding, frame]);

  const handleDownloadWebm = useCallback(async () => {
    if (encoding) return;
    setEncoding('webm');
    setEncodeProgress(0);
    setEncodeError(null);
    try {
      const blob = await encodeWebm({
        cutFrames,
        layout: cutLayout,
        bgColor: frame.bg,
        inkColor: frame.ink,
        brandText: frame.brandText,
        brandFont: frame.brandFont,
        brandFontWeight: frame.brandFontStyle,
        outerBorder: frame.outerBorder,
        outerBorderColor: frame.outerBorderColor,
        innerBorderColor: frame.innerBorderColor,
        onProgress: (p) => setEncodeProgress(p),
      });
      await downloadBlob(blob, `pic-paw_${Date.now()}.webm`, 'video/webm');
    } catch (err) {
      setEncodeError(err instanceof Error ? err.message : 'WebM 생성 실패');
    } finally {
      setEncoding(null);
      setEncodeProgress(0);
    }
  }, [cutFrames, cutLayout, encoding, frame]);

  const haveAllShots = shots.length >= 4;
  const petW = geom.cellW * PET_REL;
  const petH = petImage ? petW * (petImage.height / petImage.width) : petW;

  // Speech bubble lives on cut index 2 in both layouts. In 1×4 that's the
  // 3rd row; in 2×2 it's the bottom-left cell. Same anchor logic works
  // because cellOf already returns the right cell origin.
  const speechLayout = useMemo(() => {
    const shot = shots[2];
    if (!shot) return null;
    const cell = geom.cellOf(2);
    const petCx = shot.petPosition.x * geom.cellW;
    const petCy = shot.petPosition.y * geom.cellH;
    const w = Math.min(petW * 0.95, geom.cellW * 0.55);
    const h = w / SPEECH_BUBBLE_ASPECT;
    let x = petCx + petW * 0.10;
    let y = petCy - petH * 0.30 - h;
    x = Math.min(Math.max(x, 4), geom.cellW - w - 4);
    y = Math.min(Math.max(y, 4), geom.cellH - h - 4);
    return { x: cell.x + x, y: cell.y + y, w, h };
  }, [petH, petW, shots, geom]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="text-center">
        <h2 className="text-2xl font-head font-extrabold text-ink">스트립 미리보기 & 저장</h2>
        <p className="text-ink/70 mt-1 text-sm">
          색과 레이아웃을 고르고 다운로드해보세요.
        </p>
      </div>

      {!haveAllShots && (
        <div className="text-sm text-red-500">
          촬영된 컷이 부족합니다. Step 3 부스로 돌아가 다시 촬영해주세요.
        </div>
      )}

      <div
        ref={stripContainerRef}
        className={`overflow-hidden ${frame.containerClass}`}
        style={{
          width: displayWidth,
          maxWidth: '100%',
          height: displayHeight,
          border: frame.outerBorder
            ? `${frame.outerBorder}px solid ${frame.outerBorderColor}`
            : 'none',
        }}
      >
        <Stage
          ref={stageRef}
          width={innerWidth}
          height={innerHeight}
          scaleX={displayScale}
          scaleY={displayScale}
        >
          <Layer>
            <Rect x={0} y={0} width={STRIP_W} height={geom.stripH} fill={frame.bg} />

            <Text
              x={0}
              y={22}
              width={STRIP_W}
              text={frame.brandText}
              fontSize={26}
              fontStyle={frame.brandFontStyle}
              fontFamily={frame.brandFont}
              fill={frame.ink}
              align="center"
            />

            {[0, 1, 2, 3].map((i) => {
              const cell = geom.cellOf(i);
              const img = shotImages[i];
              return (
                <Group key={i}>
                  <Rect
                    x={cell.x - 1.5}
                    y={cell.y - 1.5}
                    width={geom.cellW + 3}
                    height={geom.cellH + 3}
                    stroke={frame.innerBorderColor}
                    strokeWidth={1.5}
                  />
                  <Rect
                    x={cell.x}
                    y={cell.y}
                    width={geom.cellW}
                    height={geom.cellH}
                    fill="#000"
                  />
                  {img && (
                    <KonvaImage
                      image={img}
                      x={cell.x}
                      y={cell.y}
                      width={geom.cellW}
                      height={geom.cellH}
                    />
                  )}
                </Group>
              );
            })}

            {speechText && speechLayout && (
              <Text
                x={speechLayout.x + speechLayout.w * 0.14}
                y={speechLayout.y + speechLayout.h * 0.22}
                width={speechLayout.w * 0.72}
                height={speechLayout.h * 0.52}
                text={speechText}
                fontSize={Math.max(12, speechLayout.h * 0.17)}
                fontFamily="Gaegu, 'Nanum Pen Script', cursive"
                fontStyle="bold"
                fill="#1A1714"
                align="center"
                verticalAlign="middle"
              />
            )}
          </Layer>
        </Stage>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono tracking-wider text-ink/70">프레임 색</span>
          <div role="radiogroup" aria-label="프레임 색" className="flex gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={frameColor === 'black'}
              onClick={() => setFrameColor('black')}
              disabled={encoding !== null}
              className={
                frameColor === 'black'
                  ? 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-ink text-surface border-2 border-ink'
                  : 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-surface text-ink border-2 border-ink hover:bg-ink/5'
              }
            >
              검정
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={frameColor === 'white'}
              onClick={() => setFrameColor('white')}
              disabled={encoding !== null}
              className={
                frameColor === 'white'
                  ? 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-ink text-surface border-2 border-ink'
                  : 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-surface text-ink border-2 border-ink hover:bg-ink/5'
              }
            >
              화이트
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono tracking-wider text-ink/70">레이아웃</span>
          <div role="radiogroup" aria-label="레이아웃" className="flex gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={cutLayout === '1x4'}
              onClick={() => setCutLayout('1x4')}
              disabled={encoding !== null}
              className={
                cutLayout === '1x4'
                  ? 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-ink text-surface border-2 border-ink'
                  : 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-surface text-ink border-2 border-ink hover:bg-ink/5'
              }
            >
              세로 1×4
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={cutLayout === '2x2'}
              onClick={() => setCutLayout('2x2')}
              disabled={encoding !== null}
              className={
                cutLayout === '2x2'
                  ? 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-ink text-surface border-2 border-ink'
                  : 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-surface text-ink border-2 border-ink hover:bg-ink/5'
              }
            >
              격자 2×2
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <Button
          onClick={handleDownload}
          size="lg"
          disabled={!haveAllShots || encoding !== null}
        >
          사진
        </Button>
        <Button
          onClick={handleDownloadGif}
          size="lg"
          disabled={!haveAnimatedFrames || encoding !== null}
        >
          {encoding === 'gif'
            ? `GIF ${Math.round(encodeProgress * 100)}%`
            : 'GIF'}
        </Button>
        <Button
          onClick={handleDownloadWebm}
          size="lg"
          disabled={!haveAnimatedFrames || encoding !== null}
        >
          {encoding === 'webm'
            ? `영상 ${Math.round(encodeProgress * 100)}%`
            : '영상'}
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button
          onClick={handleShare}
          variant="secondary"
          disabled={!haveAllShots || encoding !== null}
        >
          {shareResult === 'shared'
            ? '공유 완료!'
            : shareResult === 'copied'
            ? '클립보드 복사됨'
            : '공유'}
        </Button>
      </div>

      {encodeError && (
        <p className="text-sm text-red-500 text-center max-w-md">{encodeError}</p>
      )}

      <Button
        variant="ghost"
        onClick={() => setStep(3)}
        disabled={encoding !== null}
      >
        다시 촬영
      </Button>
    </div>
  );
}
