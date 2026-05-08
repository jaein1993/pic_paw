'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { useTheme } from '@/shared/hooks/useTheme';
import type { ThemeVersion } from '@/shared/types';
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
const CELL_W = 320;
const CELL_H = 320;
const CELL_X = (STRIP_W - CELL_W) / 2;
const GAP = 8;
const FOOTER_H = 56;
const STRIP_H = HEADER_H + 4 * CELL_H + 3 * GAP + FOOTER_H;
const PET_REL = 0.55;

interface FrameStyle {
  bg: string;
  ink: string;
  meta: string;
  brandFont: string;
  brandFontStyle: string;
  brandText: string;
  metaFont: string;
  outerBorder: number;
  outerBorderColor: string;
  innerBorderColor: string;
  containerClass: string;
}

function frameStyleFor(version: ThemeVersion): FrameStyle {
  if (version === 'A') {
    return {
      bg: '#1A1714',
      ink: '#F4EFE6',
      meta: 'rgba(244,239,230,0.7)',
      brandFont: 'Nanum Myeongjo, serif',
      brandFontStyle: 'bold',
      brandText: 'Pic-paw',
      metaFont: 'Space Mono, monospace',
      outerBorder: 0,
      outerBorderColor: '#1A1714',
      innerBorderColor: '#F4EFE6',
      containerClass: 'shadow-[0_12px_30px_-10px_rgba(0,0,0,0.35)]',
    };
  }
  return {
    bg: '#FFB7D5',
    ink: '#1A1714',
    meta: 'rgba(26,23,20,0.7)',
    brandFont: 'Black Han Sans, sans-serif',
    brandFontStyle: 'normal',
    brandText: '★ Pic-paw ★',
    metaFont: 'Space Mono, monospace',
    outerBorder: 3,
    outerBorderColor: '#1A1714',
    innerBorderColor: '#1A1714',
    containerClass: 'shadow-[5px_5px_0_#1A1714]',
  };
}

export function FrameDownload() {
  const { petImageUrl, shots, cutFrames, setStep, speechText } = useEditorState();
  const { version } = useTheme();
  const frame = useMemo(() => frameStyleFor(version), [version]);

  const stageRef = useRef<Konva.Stage>(null);
  const stripContainerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(STRIP_W);

  // Track BOTH the strip container width AND the viewport height so the
  // strip fits without scrolling on portrait phones. We pick the smaller of:
  //   • container width
  //   • viewport-height-derived width (so strip never exceeds ~70vh tall)
  //   • original STRIP_W (no upscaling)
  useEffect(() => {
    const el = stripContainerRef.current;
    if (!el) return;
    const update = () => {
      const widthCap = el.offsetWidth;
      const viewportHeightCap = (window.innerHeight * 0.7) * (STRIP_W / STRIP_H);
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
  }, []);

  const displayScale = displayWidth / STRIP_W;
  const displayHeight = STRIP_H * displayScale;

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

  const dateString = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${dd}`;
  }, []);

  const serial = useMemo(() => {
    const n = (Date.now() % 9999).toString().padStart(4, '0');
    return `NO.${n}`;
  }, []);

  // Export the strip at 2× the original (un-scaled) STRIP_W resolution so a
  // downscaled-on-mobile preview still produces a sharp PNG.
  const exportPixelRatio = (2 * STRIP_W) / Math.max(displayWidth, 1);

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

  const metaText = `${dateString}   ·   PET 4 CUT   ·   ${serial}`;

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
        bgColor: frame.bg,
        inkColor: frame.ink,
        metaColor: frame.meta,
        brandText: frame.brandText,
        brandFont: frame.brandFont,
        brandFontWeight: frame.brandFontStyle,
        metaFont: frame.metaFont,
        outerBorder: frame.outerBorder,
        outerBorderColor: frame.outerBorderColor,
        innerBorderColor: frame.innerBorderColor,
        metaText,
        onProgress: (p) => setEncodeProgress(p),
      });
      downloadBlob(blob, `pic-paw_${Date.now()}.gif`);
    } catch (err) {
      setEncodeError(err instanceof Error ? err.message : 'GIF 생성 실패');
    } finally {
      setEncoding(null);
      setEncodeProgress(0);
    }
  }, [cutFrames, encoding, frame, metaText]);

  const handleDownloadWebm = useCallback(async () => {
    if (encoding) return;
    setEncoding('webm');
    setEncodeProgress(0);
    setEncodeError(null);
    try {
      const blob = await encodeWebm({
        cutFrames,
        bgColor: frame.bg,
        inkColor: frame.ink,
        metaColor: frame.meta,
        brandText: frame.brandText,
        brandFont: frame.brandFont,
        brandFontWeight: frame.brandFontStyle,
        metaFont: frame.metaFont,
        outerBorder: frame.outerBorder,
        outerBorderColor: frame.outerBorderColor,
        innerBorderColor: frame.innerBorderColor,
        metaText,
        onProgress: (p) => setEncodeProgress(p),
      });
      downloadBlob(blob, `pic-paw_${Date.now()}.webm`);
    } catch (err) {
      setEncodeError(err instanceof Error ? err.message : 'WebM 생성 실패');
    } finally {
      setEncoding(null);
      setEncodeProgress(0);
    }
  }, [cutFrames, encoding, frame, metaText]);

  const haveAllShots = shots.length >= 4;
  const petW = CELL_W * PET_REL;
  const petH = petImage ? petW * (petImage.height / petImage.width) : petW;

  const speechLayout = useMemo(() => {
    const shot = shots[2];
    if (!shot) return null;
    const petCx = shot.petPosition.x * CELL_W;
    const petCy = shot.petPosition.y * CELL_H;
    const w = Math.min(petW * 0.95, CELL_W * 0.55);
    const h = w / SPEECH_BUBBLE_ASPECT;
    let x = petCx + petW * 0.10;
    let y = petCy - petH * 0.30 - h;
    x = Math.min(Math.max(x, 4), CELL_W - w - 4);
    y = Math.min(Math.max(y, 4), CELL_H - h - 4);
    return {
      x: CELL_X + x,
      y: HEADER_H + 2 * (CELL_H + GAP) + y,
      w,
      h,
    };
  }, [petH, petW, shots]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="text-center">
        <h2 className="text-2xl font-head font-extrabold text-ink">스트립 미리보기 & 저장</h2>
        <p className="text-ink/70 mt-1 text-sm">
          헤더의 A/B 토글로 차분한 사진관 / 키치 부스 톤을 바꿀 수 있어요.
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
          width={displayWidth}
          height={displayHeight}
          scaleX={displayScale}
          scaleY={displayScale}
        >
          <Layer>
            <Rect x={0} y={0} width={STRIP_W} height={STRIP_H} fill={frame.bg} />

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
              const cellY = HEADER_H + i * (CELL_H + GAP);
              const img = shotImages[i];
              return (
                <Group key={i}>
                  <Rect
                    x={CELL_X - 1.5}
                    y={cellY - 1.5}
                    width={CELL_W + 3}
                    height={CELL_H + 3}
                    stroke={frame.innerBorderColor}
                    strokeWidth={1.5}
                  />
                  <Rect x={CELL_X} y={cellY} width={CELL_W} height={CELL_H} fill="#000" />
                  {img && (
                    <KonvaImage
                      image={img}
                      x={CELL_X}
                      y={cellY}
                      width={CELL_W}
                      height={CELL_H}
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

            <Text
              x={0}
              y={STRIP_H - FOOTER_H + 18}
              width={STRIP_W}
              text={`${dateString}   ·   PET 4 CUT   ·   ${serial}`}
              fontSize={11}
              fontFamily={frame.metaFont}
              fill={frame.meta}
              align="center"
              letterSpacing={2}
            />
          </Layer>
        </Stage>
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
