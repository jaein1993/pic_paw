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

export interface HandTrackingOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  // Smoothing factor 0..1 — higher = more responsive, lower = smoother.
  smoothing?: number;
}

export function useHandTracking({ enabled, videoRef, smoothing = 0.35 }: HandTrackingOptions): {
  status: Status;
  point: HandPoint | null;
  errorMessage: string | null;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<HandPoint | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId = 0;
    let landmarker: HandLandmarkerInstance | null = null;
    let smoothed: HandPoint | null = null;

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
        const lm = (await vision.HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        })) as HandLandmarkerInstance;
        if (cancelled) {
          lm?.close?.();
          return;
        }
        landmarker = lm;
        setStatus('ready');
        loop();
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : '손 인식 모델을 불러오지 못했어요.');
      }
    })();

    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && landmarker) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const hand = result.landmarks?.[0];
          if (hand && hand.length > 0) {
            let sx = 0;
            let sy = 0;
            for (const i of PALM_INDICES) {
              sx += hand[i].x;
              sy += hand[i].y;
            }
            const rawX = sx / PALM_INDICES.length;
            const rawY = sy / PALM_INDICES.length;
            // Mirror x to match the CSS-flipped selfie video the user sees.
            const mirroredX = 1 - rawX;
            const next: HandPoint = { x: clamp01(mirroredX), y: clamp01(rawY) };
            smoothed = smoothed
              ? {
                  x: smoothed.x + (next.x - smoothed.x) * smoothing,
                  y: smoothed.y + (next.y - smoothed.y) * smoothing,
                }
              : next;
            setPoint(smoothed);
          }
        } catch {
          // Frame failed — skip and try again next tick.
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
      setPoint(null);
      setStatus('idle');
    };
  }, [enabled, videoRef, smoothing]);

  return { status, point, errorMessage };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
