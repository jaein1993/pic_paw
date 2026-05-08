'use client';

import { useEffect, useState } from 'react';

// Track the user's palm via MediaPipe Tasks Vision (loaded lazily from a CDN
// so the home page isn't paying the cost). The hook returns the current palm
// position normalized to [0..1] in MIRRORED space — i.e. matches the flipped
// selfie video the user sees on screen — so it can be assigned directly to
// `petPosition`.

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface HandPoint {
  x: number;
  y: number;
}

interface HandLandmarkerInstance {
  detectForVideo: (
    v: HTMLVideoElement,
    ts: number
  ) => { landmarks: Array<Array<{ x: number; y: number }>> };
  close?: () => void;
}

const VISION_BUNDLE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

// We average wrist (0) + middle finger MCP (9) for a stable palm centroid.
const PALM_INDICES = [0, 9];
// Thumb tip and index tip — distance between them = pinch openness.
const THUMB_TIP = 4;
const INDEX_TIP = 8;
// Wrist → middle fingertip distance acts as overall palm extension.
// Values around 0.05–0.10 = curled fist, 0.20+ = fully spread open palm.
const WRIST = 0;
const MIDDLE_TIP = 12;

export interface HandTrackingOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  // Smoothing factor 0..1 — higher = more responsive, lower = smoother.
  smoothing?: number;
}

export function useHandTracking({ enabled, videoRef, smoothing = 0.35 }: HandTrackingOptions): {
  status: Status;
  point: HandPoint | null;
  secondPoint: HandPoint | null;
  pinchDistance: number | null;
  palmExtension: number | null;
  errorMessage: string | null;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<HandPoint | null>(null);
  const [secondPoint, setSecondPoint] = useState<HandPoint | null>(null);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [palmExtension, setPalmExtension] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId = 0;
    let landmarker: HandLandmarkerInstance | null = null;
    let smoothed: HandPoint | null = null;
    let smoothedSecond: HandPoint | null = null;
    let smoothedPinch: number | null = null;
    let smoothedExtension: number | null = null;

    setStatus('loading');
    setErrorMessage(null);

    (async () => {
      try {
        // Build the dynamic import via Function() so neither webpack nor
        // turbopack tries to resolve the remote URL at bundle time.
        const runtimeImport = new Function('u', 'return import(u)') as (
          u: string
        ) => Promise<unknown>;
        const vision = (await runtimeImport(VISION_BUNDLE_URL)) as {
          FilesetResolver: { forVisionTasks: (wasmBase: string) => Promise<unknown> };
          HandLandmarker: {
            createFromOptions: (
              resolver: unknown,
              opts: Record<string, unknown>
            ) => Promise<unknown>;
          };
        };
        if (cancelled) return;
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_BASE_URL);
        if (cancelled) return;
        // GPU delegate fails on many mobile browsers (iOS Safari in particular —
        // WebGL context creation for MediaPipe inference is flaky). Try GPU
        // first for desktop perf, fall back to CPU so mobile users still get
        // hand tracking instead of a silent failure.
        const createWithDelegate = async (delegate: 'GPU' | 'CPU') =>
          (await vision.HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          })) as HandLandmarkerInstance;
        let lm: HandLandmarkerInstance;
        try {
          lm = await createWithDelegate('GPU');
        } catch (gpuErr) {
          if (cancelled) return;
          console.warn('[handTracking] GPU delegate failed, falling back to CPU', gpuErr);
          lm = await createWithDelegate('CPU');
        }
        if (cancelled) {
          lm?.close?.();
          return;
        }
        landmarker = lm;
        setStatus('ready');
        loop();
      } catch (e) {
        if (cancelled) return;
        console.error('[handTracking] model load failed', e);
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : '손 인식 모델을 불러오지 못했어요.');
      }
    })();

    function palmCentroid(hand: Array<{ x: number; y: number }>): HandPoint {
      let sx = 0;
      let sy = 0;
      for (const i of PALM_INDICES) {
        sx += hand[i].x;
        sy += hand[i].y;
      }
      const rawX = sx / PALM_INDICES.length;
      const rawY = sy / PALM_INDICES.length;
      // Mirror x to match the CSS-flipped selfie video the user sees.
      return { x: clamp01(1 - rawX), y: clamp01(rawY) };
    }

    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && landmarker) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const hands = result.landmarks ?? [];

          if (hands.length > 0 && hands[0].length > 0) {
            const primary = palmCentroid(hands[0]);
            smoothed = smoothed
              ? {
                  x: smoothed.x + (primary.x - smoothed.x) * smoothing,
                  y: smoothed.y + (primary.y - smoothed.y) * smoothing,
                }
              : primary;
            setPoint(smoothed);

            // Pinch distance — raw landmark space (not mirrored; only used as
            // a magnitude). Thumb tip ↔ index tip.
            const t = hands[0][THUMB_TIP];
            const i = hands[0][INDEX_TIP];
            const dx = t.x - i.x;
            const dy = t.y - i.y;
            const rawPinch = Math.sqrt(dx * dx + dy * dy);
            smoothedPinch =
              smoothedPinch === null
                ? rawPinch
                : smoothedPinch + (rawPinch - smoothedPinch) * smoothing;
            setPinchDistance(smoothedPinch);

            // Palm extension — wrist to middle fingertip. Used to detect
            // open-palm "stop" gesture.
            const w = hands[0][WRIST];
            const m = hands[0][MIDDLE_TIP];
            const ex = m.x - w.x;
            const ey = m.y - w.y;
            const rawExt = Math.sqrt(ex * ex + ey * ey);
            smoothedExtension =
              smoothedExtension === null
                ? rawExt
                : smoothedExtension + (rawExt - smoothedExtension) * smoothing;
            setPalmExtension(smoothedExtension);
          }

          if (hands.length > 1 && hands[1].length > 0) {
            const second = palmCentroid(hands[1]);
            smoothedSecond = smoothedSecond
              ? {
                  x: smoothedSecond.x + (second.x - smoothedSecond.x) * smoothing,
                  y: smoothedSecond.y + (second.y - smoothedSecond.y) * smoothing,
                }
              : second;
            setSecondPoint(smoothedSecond);
          } else if (smoothedSecond !== null) {
            smoothedSecond = null;
            setSecondPoint(null);
          }
        } catch (err) {
          // Frame failed — skip and try again next tick. Log so mobile
          // failures don't disappear silently.
          console.warn('[handTracking] detect frame failed', err);
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      landmarker?.close?.();
      landmarker = null;
      smoothed = null;
      smoothedSecond = null;
      smoothedPinch = null;
      smoothedExtension = null;
      setPoint(null);
      setSecondPoint(null);
      setPinchDistance(null);
      setPalmExtension(null);
      setStatus('idle');
    };
  }, [enabled, videoRef, smoothing]);

  return { status, point, secondPoint, pinchDistance, palmExtension, errorMessage };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
