'use client';

import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import {
  SUNGLASSES_SVG,
  SUNGLASSES_ASPECT,
  HEART_PIN_SVG,
  HEART_PIN_ASPECT,
  SPEECH_BUBBLE_ASPECT,
  buildSpeechBubbleSvg,
  svgToDataUrl,
} from './decorations';
import type { DecorationKind } from '@/shared/types';

interface PetBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface Props {
  kind: DecorationKind;
  pet: PetBox;
  speechText?: string;
  stageW: number;
  stageH: number;
}

// Decorations are sized and positioned relative to the pet's bounding box so
// they always fit the dog regardless of zoom/scale. Coordinates are in stage
// pixels.
export function DecorationOverlay({ kind, pet, speechText = '', stageW, stageH }: Props) {
  if (kind === 'plain') return null;

  if (kind === 'sunglasses') {
    const w = pet.w * 0.5;
    const h = w / SUNGLASSES_ASPECT;
    const eyeLineY = pet.cy - pet.h * 0.22;
    const x = Math.min(Math.max(pet.cx - w / 2, 4), stageW - w - 4);
    const y = Math.min(Math.max(eyeLineY - h / 2, 4), stageH - h - 4);
    return <SvgImage url={svgToDataUrl(SUNGLASSES_SVG)} x={x} y={y} w={w} h={h} />;
  }

  if (kind === 'heart') {
    const w = pet.w * 0.45;
    const h = w / HEART_PIN_ASPECT;
    const x = Math.min(Math.max(pet.cx - w / 2, 4), stageW - w - 4);
    const petTop = pet.cy - pet.h / 2;
    // The SVG includes a long pin under the heart. Anchor the heart body, not
    // the pin tip, so it sits right above the dog's head.
    const heartBodyBottomRatio = 0.39;
    const y = Math.min(Math.max(petTop - h * heartBodyBottomRatio + 4, 4), stageH - h - 4);
    return <SvgImage url={svgToDataUrl(HEART_PIN_SVG)} x={x} y={y} w={w} h={h} />;
  }

  if (kind === 'speech') {
    const w = Math.min(pet.w * 0.95, stageW * 0.55);
    const h = w / SPEECH_BUBBLE_ASPECT;
    // Speech bubble sits to the upper-right of the dog's head; the tail
    // hangs near the dog's mouth.
    let x = pet.cx + pet.w * 0.10;
    let y = pet.cy - pet.h * 0.30 - h;
    x = Math.min(Math.max(x, 4), stageW - w - 4);
    y = Math.min(Math.max(y, 4), stageH - h - 4);
    return <SvgImage url={svgToDataUrl(buildSpeechBubbleSvg(speechText))} x={x} y={y} w={w} h={h} />;
  }

  return null;
}

function SvgImage({ url, x, y, w, h }: { url: string; x: number; y: number; w: number; h: number }) {
  const [img] = useImage(url);
  if (!img) return null;
  return <KonvaImage image={img} x={x} y={y} width={w} height={h} listening={false} />;
}
