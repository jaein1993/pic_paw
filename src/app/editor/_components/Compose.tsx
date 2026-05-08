'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { useHandTracking } from '@/app/editor/_hooks/useHandTracking';
import { Button } from '@/shared/components/ui/Button';
import { startCamera, stopStream } from '@/app/editor/_lib/camera';
import { loadImage } from '@/app/editor/_lib/canvas';
import type { Shot } from '@/shared/types';
import { CELL_DECORATIONS } from '@/shared/types';
import { DecorationOverlay } from './DecorationOverlay';

const CAPTURE_SIZE = 720;
const SHOTS_TARGET = 4;
const COUNTDOWN_FROM = 10;
const FLASH_MS = 200;
const REST_MS = 1500;
const PET_REL = 0.55;
// Palm extension above this = "open palm shown" → instantly halt spin.
// Set high enough that a relaxed hand pose doesn't accidentally trigger it —
// only a deliberately fully-spread palm should stop the spin.
const PALM_OPEN_THRESHOLD = 0.34;

// Per-cell GIF/WebM frame recording during the 5-second countdown.
const FRAME_SIZE = 200;
const FRAME_FPS = 8;
const FRAME_INTERVAL_MS = 1000 / FRAME_FPS;

// One-hand circular palm motion → angular-velocity impulse with momentum +
// decay (OIIA-cat tornado feel). Phone-friendly — no need for two-hand twist.
// Open-palm gesture is the explicit stop.
const SPIN_AMPLIFY = 18;
const ROT_DECAY = 0.95;
const ROT_VELOCITY_MAX = 50; // deg per rAF tick (≈60fps) → ≈8 rotations/sec
const ROT_VELOCITY_FLOOR = 0.05;
const HAND_HISTORY_LEN = 5;

// Scale gestures — pet size mapped directly to thumb-index distance.
// User just shows their hand: tighter pinch = smaller pet, wider spread =
// bigger pet. No "engage" step required — natural and discoverable.
const SCALE_MIN = 0.25;
const SCALE_MAX = 3.0;
const SCALE_DEFAULT = 1.0;
const SCALE_SMOOTH = 0.22;
// Pinch distance range that maps to the full scale range. Below MIN clamps
// to SCALE_MIN, above MAX clamps to SCALE_MAX.
const PINCH_MIN_DIST = 0.04;
const PINCH_MAX_DIST = 0.22;

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.min(el.offsetWidth, 720);
      setSize(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Compose() {
  const {
    petImageUrl,
    petPosition,
    setPetPosition,
    pushShot,
    clearShots,
    setStep,
    shots,
    setSpeechText,
    setCutFrames,
    clearCutFrames,
  } = useEditorState();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const petRef = useRef<Konva.Image>(null);
  const sessionRef = useRef(false);
  const petPositionRef = useRef(petPosition);

  const size = useContainerSize(containerRef);

  const [petImage] = useImage(petImageUrl ?? '');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotsTakenLocal, setShotsTakenLocal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(true);
  const [petPlacementLocked, setPetPlacementLocked] = useState(false);
  const [captureFrozen, setCaptureFrozen] = useState(false);
  // Rotation is opt-in — too easy to accidentally spin the pet otherwise.
  const [rotationEnabled, setRotationEnabled] = useState(false);

  const {
    status: handStatus,
    point: handPoint,
    secondPoint: handSecondPoint,
    pinchDistance,
    palmExtension,
    errorMessage: handError,
    stats: handStats,
  } = useHandTracking({
    enabled: handTrackingEnabled,
    videoRef,
  });
  const palmOpen = palmExtension !== null && palmExtension > PALM_OPEN_THRESHOLD;

  // Start the live camera stream when this step mounts.
  useEffect(() => {
    let cancelled = false;
    const v = videoRef.current;
    if (!v) return;
    (async () => {
      try {
        const stream = await startCamera(v, 'user');
        if (cancelled) return;
        streamRef.current = stream;
      } catch {
        if (!cancelled) setCameraError('카메라 접근 권한이 필요합니다.');
      }
    })();
    // Don't stop the stream on unmount — it's the shared editor camera and
    // Step 2 may still want to display it. Stream is released when the user
    // leaves the editor entirely (EditorContainer cleanup).
    return () => {
      cancelled = true;
      streamRef.current = null;
    };
  }, []);

  // Coming back from a completed session: drop the old shots AND the old
  // speech text so this is a fresh strip. Mid-flow back-and-forth (e.g.
  // Step3 → Step2 → Step3) keeps whatever the user has typed.
  useEffect(() => {
    if (!sessionRef.current && shots.length > 0) {
      clearShots();
      clearCutFrames();
      setSpeechText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    petPositionRef.current = petPosition;
  }, [petPosition]);

  // Drive pet position from the tracked hand point until the user locks it.
  // Mouse-drag still works as a fallback when no hand is detected.
  useEffect(() => {
    if (!handTrackingEnabled || !handPoint || petPlacementLocked || captureFrozen) return;
    setPetPosition({ x: handPoint.x, y: handPoint.y });
  }, [handPoint, handTrackingEnabled, petPlacementLocked, captureFrozen, setPetPosition]);

  // Position lock = full freeze: stop any in-flight spin and ignore future
  // gesture-driven rotation/scale until unlocked.
  useEffect(() => {
    if (petPlacementLocked) {
      spinVelocityRef.current = 0;
      handHistoryRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petPlacementLocked]);

  // ─── Rotation + scale engine ────────────────────────────────────────────
  // Rotation is driven exclusively by two-hand twist with momentum + decay.
  // Scale is driven exclusively by one-hand pinch with grab-and-stretch
  // semantics (anchor on pinch start, ratio = currentDist / anchorDist).
  // Position keeps using the primary palm centroid. Each gesture has a
  // single role so they never fight each other.
  const [petRotation, setPetRotation] = useState(0);
  const [petScale, setPetScale] = useState(SCALE_DEFAULT);
  const rotationRef = useRef(0);
  const spinVelocityRef = useRef(0);
  const handHistoryRef = useRef<Array<{ x: number; y: number }>>([]);
  const scaleRef = useRef(SCALE_DEFAULT);
  const targetScaleRef = useRef(SCALE_DEFAULT);

  // rAF loop: bleed spin velocity (rotation) + lerp scale toward target.
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const v = spinVelocityRef.current;
      if (Math.abs(v) > ROT_VELOCITY_FLOOR) {
        rotationRef.current += v;
        spinVelocityRef.current = v * ROT_DECAY;
        setPetRotation(rotationRef.current);
      } else if (v !== 0) {
        spinVelocityRef.current = 0;
      }

      const target = targetScaleRef.current;
      const cur = scaleRef.current;
      if (Math.abs(target - cur) > 0.001) {
        const next = cur + (target - cur) * SCALE_SMOOTH;
        scaleRef.current = next;
        setPetScale(next);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ONE-HAND pinch → scale (direct linear mapping, always active). The
  // user just shows their hand and the thumb-index distance maps directly
  // to pet size. Tight pinch = SCALE_MIN, wide spread = SCALE_MAX.
  useEffect(() => {
    if (
      !handTrackingEnabled ||
      captureFrozen ||
      petPlacementLocked ||
      pinchDistance === null
    ) {
      return;
    }
    const clamped = Math.max(
      PINCH_MIN_DIST,
      Math.min(PINCH_MAX_DIST, pinchDistance),
    );
    const t = (clamped - PINCH_MIN_DIST) / (PINCH_MAX_DIST - PINCH_MIN_DIST);
    targetScaleRef.current = SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
  }, [pinchDistance, handTrackingEnabled, captureFrozen, petPlacementLocked]);

  // OPEN-PALM stop. When the user shows a flat extended palm to the camera
  // we instantly kill any accumulated spin. Works even when the pet image
  // visually covers the user's hand because MediaPipe reads the raw <video>
  // stream, not the composited canvas.
  useEffect(() => {
    if (palmOpen && spinVelocityRef.current !== 0) {
      spinVelocityRef.current = 0;
    }
  }, [palmOpen]);

  // ONE-HAND circular palm motion → rotation impulse. We keep a short window
  // of recent palm positions, compute the angular velocity of the latest
  // sample around the window's centroid, and add that as an impulse to the
  // spin velocity. Tiny wrist circles pile up impulses fast → tornado.
  // Disabled by default — user must explicitly enable via the toggle button
  // (rotation can be confusing/accidental during composition).
  useEffect(() => {
    if (
      !handTrackingEnabled ||
      !rotationEnabled ||
      captureFrozen ||
      petPlacementLocked ||
      !handPoint
    ) {
      handHistoryRef.current = [];
      return;
    }
    const hist = handHistoryRef.current;
    hist.push({ x: handPoint.x, y: handPoint.y });
    if (hist.length > HAND_HISTORY_LEN) hist.shift();
    if (hist.length < 3) return;

    let cx = 0;
    let cy = 0;
    for (const p of hist) {
      cx += p.x;
      cy += p.y;
    }
    cx /= hist.length;
    cy /= hist.length;

    const curr = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const rx = curr.x - cx;
    const ry = curr.y - cy;
    const r2 = rx * rx + ry * ry;
    if (r2 < 0.0005) return;

    const vx = curr.x - prev.x;
    const vy = curr.y - prev.y;
    const omega = (rx * vy - ry * vx) / r2;
    const impulseDeg = omega * (180 / Math.PI) * SPIN_AMPLIFY;

    const next = spinVelocityRef.current + impulseDeg;
    spinVelocityRef.current = Math.max(
      -ROT_VELOCITY_MAX,
      Math.min(ROT_VELOCITY_MAX, next),
    );
  }, [handPoint, handTrackingEnabled, captureFrozen, petPlacementLocked, rotationEnabled]);

  const resetSpin = useCallback(() => {
    rotationRef.current = 0;
    spinVelocityRef.current = 0;
    handHistoryRef.current = [];
    setPetRotation(0);
    targetScaleRef.current = SCALE_DEFAULT;
    scaleRef.current = SCALE_DEFAULT;
    setPetScale(SCALE_DEFAULT);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const petW = size * PET_REL;
  const petH = petImage ? petW * (petImage.height / petImage.width) : petW;
  const px = petPosition.x * size;
  const py = petPosition.y * size;

  // Which decoration overlays the live preview, based on which shot we're
  // about to take (0..3). Before the session starts, show the first cell's
  // decoration so the user can preview it.
  const previewIndex = busy ? Math.min(shotsTakenLocal, SHOTS_TARGET - 1) : 0;
  const liveDecor = CELL_DECORATIONS[previewIndex];

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      setPetPosition({ x: node.x() / size, y: node.y() / size });
    },
    [setPetPosition, size]
  );

  // Synchronous small-canvas snapshot used by the GIF/WebM frame recorder.
  // Mirrors the video so the saved frame matches the user's selfie view.
  const captureSmallFrame = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    const stage = stageRef.current;
    if (!v || !stage) return null;
    if (!v.videoWidth || !v.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = FRAME_SIZE;
    canvas.height = FRAME_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.save();
    ctx.translate(FRAME_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, side, side, 0, 0, FRAME_SIZE, FRAME_SIZE);
    ctx.restore();

    const stageCanvas = stage.toCanvas({ pixelRatio: FRAME_SIZE / size });
    ctx.drawImage(stageCanvas, 0, 0, FRAME_SIZE, FRAME_SIZE);

    return canvas;
  }, [size]);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const v = videoRef.current;
    const stage = stageRef.current;
    if (!v || !stage) return null;
    if (!v.videoWidth || !v.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.save();
    ctx.translate(CAPTURE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
    ctx.restore();

    const stageDataUrl = stage.toDataURL({ pixelRatio: CAPTURE_SIZE / size });
    const stageImg = await loadImage(stageDataUrl);
    ctx.drawImage(stageImg, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    return canvas.toDataURL('image/png');
  }, [size]);

  const startBoothSession = useCallback(async () => {
    if (busy) return;
    if (!videoRef.current?.videoWidth) {
      setCameraError('카메라가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setBusy(true);
    sessionRef.current = true;
    clearShots();
    clearCutFrames();
    setShotsTakenLocal(0);

    try {
      for (let i = 0; i < SHOTS_TARGET; i++) {
        // Show "1/4" at the start of cut 1, "2/4" at cut 2, etc. — counting
        // the cut currently in progress, not completed cuts.
        setShotsTakenLocal(i + 1);

        // Auto-unlock at the start of each cut so the user can re-position
        // for the next take without manually pressing "다시 조정".
        setPetPlacementLocked(false);

        // Begin recording frames for this cut at FRAME_FPS.
        const cutFrames: HTMLCanvasElement[] = [];
        let recording = true;
        const recorderId = window.setInterval(() => {
          if (!recording) return;
          const f = captureSmallFrame();
          if (f) cutFrames.push(f);
        }, FRAME_INTERVAL_MS);

        for (let c = COUNTDOWN_FROM; c >= 1; c--) {
          setCountdown(c);
          await delay(1000);
        }
        setCountdown(null);

        // Stop the recorder for this cut and persist its frames.
        recording = false;
        window.clearInterval(recorderId);
        setCutFrames(i, cutFrames);

        setCaptureFrozen(true);
        await delay(50);
        setFlash(true);
        const dataUrl = await captureFrame();
        await delay(FLASH_MS);
        setFlash(false);
        setCaptureFrozen(false);

        if (dataUrl) {
          const currentPetPosition = petPositionRef.current;
          const shot: Shot = {
            dataUrl,
            petPosition: { x: currentPetPosition.x, y: currentPetPosition.y },
            capturedAt: Date.now(),
          };
          pushShot(shot);
          setShotsTakenLocal((n) => n + 1);
        }

        if (i < SHOTS_TARGET - 1) {
          await delay(REST_MS);
        }
      }

      // Keep the shared stream alive for "다시 촬영" — only the editor's
      // outermost cleanup releases it.
      streamRef.current = null;
      setStep(4);
    } finally {
      setBusy(false);
      setCountdown(null);
      setFlash(false);
      setCaptureFrozen(false);
    }
  }, [
    busy,
    captureFrame,
    captureSmallFrame,
    clearCutFrames,
    clearShots,
    pushShot,
    setCutFrames,
    setStep,
  ]);

  // Auto-start the booth once the camera AND the hand-tracking model are
  // ready (or after a max wait, so a slow MediaPipe load never blocks the
  // user forever). Without this, the first cut's countdown could begin
  // before MediaPipe finished loading and gestures wouldn't respond yet.
  useEffect(() => {
    if (sessionRef.current || busy) return;
    if (!petImage) return;
    let cancelled = false;
    const tryStart = async () => {
      const MAX_HAND_WAIT_ATTEMPTS = 80; // ~8s
      const MAX_TOTAL_ATTEMPTS = 120; // ~12s — start anyway after this
      let attempts = 0;
      while (!cancelled && attempts < MAX_TOTAL_ATTEMPTS) {
        const cameraReady =
          !!(videoRef.current?.videoWidth && videoRef.current?.videoHeight);
        // Resolve as ready as soon as the model loaded (or errored — the
        // booth still works without hand tracking via mouse drag).
        const handResolved = handStatus === 'ready' || handStatus === 'error';
        const waitedLongEnough = attempts >= MAX_HAND_WAIT_ATTEMPTS;
        if (cameraReady && (handResolved || waitedLongEnough)) {
          if (!cancelled) startBoothSession();
          return;
        }
        await delay(100);
        attempts++;
      }
      if (!cancelled) startBoothSession();
    };
    tryStart();
    return () => {
      cancelled = true;
    };
  }, [petImage, busy, startBoothSession, handStatus]);

  const handleBack = () => {
    // Keep stream alive — Step 2 displays it.
    streamRef.current = null;
    setStep(2);
  };

  const handStatusLabel: Record<typeof handStatus, string> = {
    idle: '손 인식 꺼짐',
    loading: '손 인식 모델 로딩 중…',
    ready: petPlacementLocked
      ? '🔒 위치 고정됨'
      : handPoint
        ? '✓ 손 인식됨'
        : '👋 카메라에 손바닥을 보여주세요',
    error: handError ?? '손 인식 실패 — 마우스로 끌어 이동해주세요',
  };

  // ?debug=1 → on-screen diagnostic overlay so we can see what MediaPipe is
  // doing on a phone without USB devtools.
  const debugMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';
  const v = videoRef.current;

  // Sample the center pixel of the live video — proves whether MediaPipe is
  // receiving actual frames (non-zero RGB) or black/blank frames.
  const [pixelSample, setPixelSample] = useState<string>('?');
  const [videoPlayState, setVideoPlayState] = useState<string>('?');
  useEffect(() => {
    if (!debugMode) return;
    const id = window.setInterval(() => {
      const vid = videoRef.current;
      if (!vid || vid.videoWidth === 0) {
        setPixelSample('no-video');
        setVideoPlayState('no-video');
        return;
      }
      try {
        const cv = document.createElement('canvas');
        cv.width = 8;
        cv.height = 8;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(vid, 0, 0, 8, 8);
        const px = ctx.getImageData(4, 4, 1, 1).data;
        setPixelSample(`rgb(${px[0]},${px[1]},${px[2]})`);
        setVideoPlayState(
          `paused=${vid.paused} t=${vid.currentTime.toFixed(2)}`,
        );
      } catch (e) {
        setPixelSample(`err:${e instanceof Error ? e.message.slice(0, 30) : 'x'}`);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [debugMode]);
  const debugInfo = debugMode
    ? {
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        handStatus,
        handError: handError ?? '(none)',
        handPoint: handPoint ? `${handPoint.x.toFixed(2)},${handPoint.y.toFixed(2)}` : '(none)',
        videoReadyState: v?.readyState ?? 'no-ref',
        videoSize: v ? `${v.videoWidth}x${v.videoHeight}` : 'no-ref',
        pinch: pinchDistance?.toFixed(3) ?? '(none)',
        palmExt: palmExtension?.toFixed(3) ?? '(none)',
        detectCalls: handStats.detectCalls,
        detectErrors: handStats.detectErrors,
        lastHands: handStats.lastHandsCount,
        lastDetectAgo: handStats.lastDetectAgo,
      }
    : null;

  const canDragPet =
    !busy && !petPlacementLocked && !(handTrackingEnabled && handStatus === 'ready' && !!handPoint);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-center">
        <h2 className="text-2xl font-head font-extrabold text-ink">Pic-paw 부스</h2>
        <p className="text-ink/70 mt-1 text-sm">
          10초 카운트다운으로 4컷 자동 촬영
        </p>
      </div>


      <div
        ref={containerRef}
        className="relative w-full max-w-md aspect-square max-h-[45vh] sm:max-h-none mx-auto overflow-hidden bg-black border-2 border-ink shadow-theme"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        <div className="absolute inset-0">
          <Stage ref={stageRef} width={size} height={size}>
            <Layer>
              {petImage && (
                <KonvaImage
                  ref={petRef}
                  image={petImage}
                  x={px}
                  y={py}
                  width={petW}
                  height={petH}
                  offsetX={petW / 2}
                  offsetY={petH / 2}
                  rotation={petRotation}
                  scaleX={petScale}
                  scaleY={petScale}
                  draggable={canDragPet}
                  onDragEnd={handleDragEnd}
                  shadowColor="rgba(0,0,0,0.45)"
                  shadowBlur={12}
                  shadowOpacity={0.6}
                />
              )}
            </Layer>
            <Layer>
              {petImage && (
                <DecorationOverlay
                  kind={liveDecor}
                  pet={{ cx: px, cy: py, w: petW, h: petH }}
                  stageW={size}
                  stageH={size}
                />
              )}
            </Layer>
          </Stage>
        </div>


        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-white text-9xl font-display pointer-events-none select-none">
            {countdown}
          </div>
        )}

        {flash && <div className="absolute inset-0 bg-white pointer-events-none" />}

        {busy && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-ink text-surface text-sm font-mono font-bold border-2 border-surface">
            {shotsTakenLocal}/{SHOTS_TARGET}
          </div>
        )}

        {palmOpen && rotationEnabled && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-accent-2 text-ink text-xs font-mono font-bold border-2 border-ink">
            ✋ 정지
          </div>
        )}
      </div>

      {cameraError && <p className="text-sm text-red-500">{cameraError}</p>}

      {debugInfo && (
        <pre className="w-full max-w-md text-[10px] leading-tight font-mono bg-ink text-surface p-2 border-2 border-ink whitespace-pre-wrap break-all">
{`status:    ${debugInfo.handStatus}
error:     ${debugInfo.handError}
point:     ${debugInfo.handPoint}
detect:    calls=${debugInfo.detectCalls} errors=${debugInfo.detectErrors} lastHands=${debugInfo.lastHands} lastAgo=${debugInfo.lastDetectAgo}ms
pinch:     ${debugInfo.pinch}
palmExt:   ${debugInfo.palmExt}
video:     readyState=${debugInfo.videoReadyState} size=${debugInfo.videoSize}
videoState:${videoPlayState}
pixel(4,4):${pixelSample}
ua:        ${debugInfo.ua}`}
        </pre>
      )}

      <div className="w-full max-w-md flex items-center justify-between gap-2 text-xs text-ink/70">
        <span className="font-mono tracking-wider">{handStatusLabel[handStatus]}</span>
        <button
          type="button"
          onClick={() => {
            setPetPlacementLocked(false);
            setHandTrackingEnabled((v) => !v);
          }}
          disabled={busy}
          className="font-mono tracking-wider underline underline-offset-2 hover:text-accent"
        >
          {handTrackingEnabled ? '마우스로 전환' : '손 인식 켜기'}
        </button>
      </div>

      <div className="w-full max-w-md grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant={petPlacementLocked ? 'primary' : 'secondary'}
          onClick={() => setPetPlacementLocked((v) => !v)}
          className="w-full"
          aria-pressed={petPlacementLocked}
        >
          <span className="flex flex-col items-center leading-tight whitespace-nowrap">
            <span>{petPlacementLocked ? '다시' : '위치'}</span>
            <span>{petPlacementLocked ? '조정' : '고정'}</span>
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setPetPosition({ x: 0.72, y: 0.6 });
            resetSpin();
          }}
          disabled={petPlacementLocked}
          className="w-full"
        >
          <span className="flex flex-col items-center leading-tight whitespace-nowrap">
            <span>위치</span>
            <span>초기화</span>
          </span>
        </Button>
        <Button
          type="button"
          variant={rotationEnabled ? 'primary' : 'secondary'}
          onClick={() => {
            if (rotationEnabled) {
              setRotationEnabled(false);
              rotationRef.current = 0;
              spinVelocityRef.current = 0;
              handHistoryRef.current = [];
              setPetRotation(0);
            } else {
              setRotationEnabled(true);
            }
          }}
          disabled={petPlacementLocked}
          className="w-full"
          aria-pressed={rotationEnabled}
        >
          <span className="flex flex-col items-center leading-tight whitespace-nowrap">
            <span>🌀 회전</span>
            <span>{rotationEnabled ? 'OFF' : 'ON'}</span>
          </span>
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button variant="ghost" onClick={handleBack} disabled={busy}>
          이전
        </Button>
      </div>
    </div>
  );
}
