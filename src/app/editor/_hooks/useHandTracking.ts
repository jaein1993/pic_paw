'use client';

import { useEffect, useRef, useState } from 'react';
import type { Hands as HandsClass, Results } from '@mediapipe/hands';

// @mediapipe/hands ships as a UMD bundle that pollutes window.Hands when
// loaded via a script tag. We can't `import { Hands }` directly — that
// fails at bundle time because the package has no ES module exports. So
// we inject the script at runtime and read the constructor off window.
type HandsCtor = new (cfg: { locateFile: (file: string) => string }) => HandsClass;
declare global {
  interface Window {
    Hands?: HandsCtor;
  }
}

// Legacy MediaPipe Hands "Solution" API. We migrated off the newer
// @mediapipe/tasks-vision HandLandmarker after the user's Galaxy phone hit
// a CalculatorGraph runtime crash that ALSO reproduced on the official
// MediaPipe Studio demo — i.e. the new graph composition is incompatible
// with that device's WebGL/WASM combo. The legacy Hands solution has been
// the production-grade hand-tracking library for mobile web since 2020 and
// works on a wider range of devices.

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface HandPoint {
  x: number;
  y: number;
}

// Load WASM/binary assets from a CDN so they aren't bundled into our app
// (saves ~5MB from the JS bundle).
const HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240';

// Landmark indices (same as Tasks Vision and standard 21-point model).
// Anchor on the row of MCP joints (index/middle/ring knuckles) — i.e. the
// top edge of the palm where the fingers attach. The previous wrist+MCP
// midpoint sat in the lower palm, which made the pet visually trail
// *below* the user's hand and clip off the bottom of the frame as they
// raised it. The MCP-row centroid puts the pet right where the user
// perceives their hand to be.
const PALM_INDICES = [5, 9, 13];
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const WRIST = 0;
const MIDDLE_TIP = 12;

export interface HandTrackingOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  smoothing?: number;
}

export interface HandTrackingStats {
  detectCalls: number;
  detectErrors: number;
  lastHandsCount: number;
  lastDetectAgo: number;
}

export function useHandTracking({ enabled, videoRef, smoothing = 0.35 }: HandTrackingOptions): {
  status: Status;
  point: HandPoint | null;
  secondPoint: HandPoint | null;
  pinchDistance: number | null;
  palmExtension: number | null;
  errorMessage: string | null;
  stats: HandTrackingStats;
} {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<HandPoint | null>(null);
  const [secondPoint, setSecondPoint] = useState<HandPoint | null>(null);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [palmExtension, setPalmExtension] = useState<number | null>(null);
  const [stats, setStats] = useState<HandTrackingStats>({
    detectCalls: 0,
    detectErrors: 0,
    lastHandsCount: 0,
    lastDetectAgo: -1,
  });
  const detectCallsRef = useRef(0);
  const detectErrorsRef = useRef(0);
  const lastHandsCountRef = useRef(0);
  const lastDetectAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId = 0;
    let hands: HandsClass | null = null;
    let isSending = false;
    // Min idle gap between successive `send()` calls. The MediaPipe Hands
    // CalculatorGraph is otherwise CPU-saturating on mid-range Galaxies —
    // it'll happily eat a whole core back-to-back, starving the camera,
    // Konva re-render and the 1-second countdown timer. A 30 ms rest after
    // each send caps effective inference at ~16–25 Hz (depending on send
    // latency), which still feels smooth visually but leaves clear CPU
    // headroom for everything else competing for the main thread.
    const MIN_SEND_GAP_MS = 30;
    let lastSendEndAt = 0;
    // Downscale frames to a tiny offscreen canvas before feeding MediaPipe.
    // MediaPipe Hands' input resolution is ~224×224 internally — passing a
    // 720×1280 video frame just makes its internal preprocessing do more
    // work for no accuracy gain. 256² is the sweet spot: ~6× fewer pixels
    // than 720×1280 → ~6× faster inference on mobile CPU.
    const INFER_SIZE = 256;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = INFER_SIZE;
    offCanvas.height = INFER_SIZE;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: false });
    let smoothed: HandPoint | null = null;
    let smoothedSecond: HandPoint | null = null;
    let smoothedPinch: number | null = null;
    let smoothedExtension: number | null = null;

    setStatus('loading');
    setErrorMessage(null);

    function palmCentroid(hand: Array<{ x: number; y: number }>): HandPoint {
      let sx = 0;
      let sy = 0;
      for (const i of PALM_INDICES) {
        sx += hand[i].x;
        sy += hand[i].y;
      }
      // selfieMode:true on the Hands solution already returns coords in the
      // user's mirrored selfie space (left hand → left side of frame), so
      // we use rawX directly without the 1-x flip.
      return { x: clamp01(sx / PALM_INDICES.length), y: clamp01(sy / PALM_INDICES.length) };
    }

    function onResults(results: Results) {
      const handsArr = results.multiHandLandmarks ?? [];
      lastHandsCountRef.current = handsArr.length;

      if (handsArr.length > 0 && handsArr[0].length > 0) {
        const primary = palmCentroid(handsArr[0]);
        smoothed = smoothed
          ? {
              x: smoothed.x + (primary.x - smoothed.x) * smoothing,
              y: smoothed.y + (primary.y - smoothed.y) * smoothing,
            }
          : primary;
        setPoint(smoothed);

        const t = handsArr[0][THUMB_TIP];
        const i = handsArr[0][INDEX_TIP];
        const dx = t.x - i.x;
        const dy = t.y - i.y;
        const rawPinch = Math.sqrt(dx * dx + dy * dy);
        smoothedPinch =
          smoothedPinch === null
            ? rawPinch
            : smoothedPinch + (rawPinch - smoothedPinch) * smoothing;
        setPinchDistance(smoothedPinch);

        const w = handsArr[0][WRIST];
        const m = handsArr[0][MIDDLE_TIP];
        const ex = m.x - w.x;
        const ey = m.y - w.y;
        const rawExt = Math.sqrt(ex * ex + ey * ey);
        smoothedExtension =
          smoothedExtension === null
            ? rawExt
            : smoothedExtension + (rawExt - smoothedExtension) * smoothing;
        setPalmExtension(smoothedExtension);
      }

      if (handsArr.length > 1 && handsArr[1].length > 0) {
        const second = palmCentroid(handsArr[1]);
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
    }

    (async () => {
      try {
        // Inject the UMD script that defines window.Hands. We dedupe on the
        // src so HMR / repeated mounts don't pile up duplicate <script> tags.
        const scriptSrc = `${HANDS_CDN}/hands.js`;
        if (!window.Hands) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(
              `script[src="${scriptSrc}"]`,
            ) as HTMLScriptElement | null;
            if (existing) {
              if (window.Hands) {
                resolve();
                return;
              }
              existing.addEventListener('load', () => resolve());
              existing.addEventListener('error', () =>
                reject(new Error('Hands script failed to load')),
              );
              return;
            }
            const s = document.createElement('script');
            s.src = scriptSrc;
            s.crossOrigin = 'anonymous';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Hands script failed to load'));
            document.head.appendChild(s);
          });
        }
        if (cancelled) return;
        const HandsCtor = window.Hands;
        if (!HandsCtor) {
          throw new Error('window.Hands not defined after script load');
        }
        const lm = new HandsCtor({
          locateFile: (file: string) => `${HANDS_CDN}/${file}`,
        });
        lm.setOptions({
          // selfieMode so MediaPipe mirrors input internally — coords come
          // back already aligned with the user's flipped selfie display.
          selfieMode: true,
          // Single hand only. Current gesture set (palm position drives pet
          // location, pinch drives scale, circular palm motion drives spin)
          // is all single-handed, so the second-hand inference slot was pure
          // overhead. Halving this halves the per-frame inference cost on
          // mobile CPU.
          maxNumHands: 1,
          // 0 = lite (smaller, faster), 1 = full (more accurate). Lite is
          // a better fit for mobile CPUs that only have a few hundred MB
          // of headroom for the WASM heap.
          modelComplexity: 0,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        lm.onResults(onResults);
        await lm.initialize();
        if (cancelled) {
          await lm.close();
          return;
        }
        hands = lm;
        setStatus('ready');
        loop();
      } catch (e) {
        if (cancelled) return;
        console.error('[handTracking] hands init failed', e);
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : '손 인식 모델을 불러오지 못했어요.');
      }
    })();

    async function loop() {
      if (cancelled) return;
      const now = performance.now();
      const enoughGap = now - lastSendEndAt >= MIN_SEND_GAP_MS;
      const video = videoRef.current;
      if (
        enoughGap &&
        video &&
        video.readyState >= 2 &&
        hands &&
        !isSending &&
        offCtx
      ) {
        isSending = true;
        try {
          detectCallsRef.current += 1;
          lastDetectAtRef.current = now;
          // Square-crop the (likely portrait) video frame into the
          // INFER_SIZE×INFER_SIZE canvas so the model doesn't waste capacity
          // on a stretched aspect ratio.
          const vw = video.videoWidth || INFER_SIZE;
          const vh = video.videoHeight || INFER_SIZE;
          const side = Math.min(vw, vh);
          const sx = (vw - side) / 2;
          const sy = (vh - side) / 2;
          offCtx.drawImage(video, sx, sy, side, side, 0, 0, INFER_SIZE, INFER_SIZE);
          await hands.send({ image: offCanvas });
        } catch (err) {
          detectErrorsRef.current += 1;
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(`detect: ${msg.slice(0, 100)}`);
          console.warn('[handTracking] send failed', err);
        } finally {
          isSending = false;
          lastSendEndAt = performance.now();
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      hands?.close().catch(() => {});
      hands = null;
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

  // Publish diagnostic counters to state every ~500ms — diagnostic only.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setStats({
        detectCalls: detectCallsRef.current,
        detectErrors: detectErrorsRef.current,
        lastHandsCount: lastHandsCountRef.current,
        lastDetectAgo: lastDetectAtRef.current
          ? Math.round(performance.now() - lastDetectAtRef.current)
          : -1,
      });
    }, 500);
    return () => window.clearInterval(id);
  }, [enabled]);

  return { status, point, secondPoint, pinchDistance, palmExtension, errorMessage, stats };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
