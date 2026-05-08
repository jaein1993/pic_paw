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
const COUNTDOWN_FROM = 5;
const FLASH_MS = 200;
const REST_MS = 1500;
const PET_REL = 0.55;

// Per-cell GIF/WebM frame recording during the 5-second countdown.
const FRAME_SIZE = 200;
const FRAME_FPS = 8;
const FRAME_INTERVAL_MS = 1000 / FRAME_FPS;

// Two-hand rotation: angle of the line between the two palms drives the pet's
// rotation directly. Multiplier > 1 amplifies the twist so the user can reach
// big rotations without contorting their wrists.
const TWO_HAND_ROTATION_MULT = 2.5;

// Scale gestures — multiplies pet base size:
//   • Two hands visible (always active): distance between palms → scale
//   • One hand: thumb-index pinch distance → scale, but ONLY while the pinch
//     is "closed" (distance below PINCH_ACTIVE_THRESHOLD). When fingers
//     spread back open, scale freezes at its last value. This stops scale
//     from wobbling when the user is just rotating or moving the hand.
// Multipliers are tuned so each mode can reach the full SCALE_MIN..SCALE_MAX
// range — pinch tightly closed = tiny, pinch right at threshold = huge.
const SCALE_MIN = 0.25;
const SCALE_MAX = 3.0;
const SCALE_DEFAULT = 1.0;
const SCALE_SMOOTH = 0.22;
const TWO_HAND_SCALE_MULT = 4.5;
const PINCH_SCALE_MULT = 38;
const PINCH_ACTIVE_THRESHOLD = 0.08;

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

  const {
    status: handStatus,
    point: handPoint,
    secondPoint: handSecondPoint,
    pinchDistance,
    errorMessage: handError,
  } = useHandTracking({
    enabled: handTrackingEnabled,
    videoRef,
  });

  // Start the live camera stream when this step mounts.
  useEffect(() => {
    let cancelled = false;
    const v = videoRef.current;
    if (!v) return;
    (async () => {
      try {
        const stream = await startCamera(v, 'user');
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
      } catch {
        if (!cancelled) setCameraError('카메라 접근 권한이 필요합니다.');
      }
    })();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
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

  // ─── Rotation + scale engine ────────────────────────────────────────────
  // Rotation is driven exclusively by two-hand twist (angle of the line
  // between palms). Scale is driven exclusively by one-hand pinch openness
  // while fingers are closed. Position keeps using the primary palm centroid.
  // Each gesture has a single role so they never fight each other.
  const [petRotation, setPetRotation] = useState(0);
  const [petScale, setPetScale] = useState(SCALE_DEFAULT);
  const rotationRef = useRef(0);
  const lastTwoHandAngleRef = useRef<number | null>(null);
  const scaleRef = useRef(SCALE_DEFAULT);
  const targetScaleRef = useRef(SCALE_DEFAULT);

  // rAF lerp for scale only — rotation is updated directly per hand sample.
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
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

  // ONE-HAND pinch → scale (only while fingers are explicitly close).
  useEffect(() => {
    if (!handTrackingEnabled || captureFrozen) return;
    if (handPoint && handSecondPoint) return; // two-hand mode handles rotation, not scale
    if (pinchDistance === null || pinchDistance >= PINCH_ACTIVE_THRESHOLD) return;
    const target = pinchDistance * PINCH_SCALE_MULT;
    targetScaleRef.current = Math.max(SCALE_MIN, Math.min(SCALE_MAX, target));
  }, [handPoint, handSecondPoint, pinchDistance, handTrackingEnabled, captureFrozen]);

  // TWO-HAND twist → rotation. Tracks angle of the line between the two
  // palms; each new sample adds the delta (× multiplier) to pet rotation.
  // When the second hand disappears the anchor resets so re-entering the
  // gesture doesn't snap.
  useEffect(() => {
    if (!handTrackingEnabled || captureFrozen) {
      lastTwoHandAngleRef.current = null;
      return;
    }
    if (!handPoint || !handSecondPoint) {
      lastTwoHandAngleRef.current = null;
      return;
    }
    const dx = handSecondPoint.x - handPoint.x;
    const dy = handSecondPoint.y - handPoint.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const last = lastTwoHandAngleRef.current;
    if (last === null) {
      lastTwoHandAngleRef.current = angle;
      return;
    }
    let delta = angle - last;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    lastTwoHandAngleRef.current = angle;
    rotationRef.current += delta * TWO_HAND_ROTATION_MULT;
    setPetRotation(rotationRef.current);
  }, [handPoint, handSecondPoint, handTrackingEnabled, captureFrozen]);

  const resetSpin = useCallback(() => {
    rotationRef.current = 0;
    lastTwoHandAngleRef.current = null;
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
  // Keeps composition (mirrored video + pet overlay) but at FRAME_SIZE.
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

      stopStream(streamRef.current);
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

  const handleBack = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStep(2);
  };

  const handStatusLabel: Record<typeof handStatus, string> = {
    idle: '손 인식 꺼짐',
    loading: '손 인식 모델 로딩 중…',
    ready: petPlacementLocked
      ? '위치 고정됨'
      : handPoint
        ? busy
          ? '손 인식 ✓ 4컷 모두 손으로 위치를 바꿀 수 있어요'
          : '손 인식 ✓ 손을 움직이면 강아지가 따라가요'
        : '손을 카메라에 보여주세요',
    error: handError ?? '손 인식 실패 — 마우스로 끌어 이동해주세요',
  };

  const canDragPet =
    !busy && !petPlacementLocked && !(handTrackingEnabled && handStatus === 'ready' && !!handPoint);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-center">
        <h2 className="text-2xl font-head font-extrabold text-ink">Pic-paw 부스</h2>
        <p className="text-ink/70 mt-1 text-sm">
          캠 앞에서 손을 움직여 강아지 위치를 잡고, 위치 고정 후 촬영을 시작하세요.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full max-w-md aspect-square overflow-hidden bg-black border-2 border-ink shadow-theme"
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

        {/* Hand cursor indicator */}
        {handTrackingEnabled && handPoint && !petPlacementLocked && !captureFrozen && (
          <div
            aria-hidden
            className="absolute w-4 h-4 rounded-full bg-accent border-2 border-ink shadow-[0_0_0_4px_rgba(255,255,255,0.6)] pointer-events-none transition-transform"
            style={{
              left: handPoint.x * size - 8,
              top: handPoint.y * size - 8,
            }}
          />
        )}

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
      </div>

      {cameraError && <p className="text-sm text-red-500">{cameraError}</p>}

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

      <div className="w-full max-w-md grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={petPlacementLocked ? 'secondary' : 'primary'}
          onClick={() => setPetPlacementLocked((v) => !v)}
          className="w-full"
          aria-pressed={petPlacementLocked}
        >
          {petPlacementLocked ? '다시 조정' : '위치 고정'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setPetPosition({ x: 0.72, y: 0.6 });
            resetSpin();
          }}
          disabled={busy || petPlacementLocked}
          className="w-full"
        >
          위치 초기화
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={startBoothSession} disabled={busy || !!cameraError}>
          {busy ? '촬영 중…' : '촬영 시작'}
        </Button>
        <Button variant="ghost" onClick={handleBack} disabled={busy}>
          이전
        </Button>
      </div>
    </div>
  );
}
