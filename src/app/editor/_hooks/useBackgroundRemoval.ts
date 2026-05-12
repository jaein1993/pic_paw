import { useState, useCallback, useEffect } from 'react';
import {
  removeImageBackground,
  type BackgroundRemovalStage,
} from '@/app/editor/_lib/backgroundRemoval';

export function useBackgroundRemoval(file: File | null): {
  result: Blob | null;
  stage: BackgroundRemovalStage | null;
  progressPercent: number;
  error: string | null;
  run: () => Promise<void>;
} {
  const [result, setResult] = useState<Blob | null>(null);
  const [stage, setStage] = useState<BackgroundRemovalStage | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fake progress fallback. The library may go silent during inference
  // (no `current/total` updates until the step finishes), which leaves the
  // bar stuck at 70%. We inch the bar forward on a timer so the UI never
  // looks frozen — capped just under the next stage boundary so real
  // updates can still overtake it.
  useEffect(() => {
    if (stage === null) return;
    const cap = stage === 'downloading' ? 69 : 99;
    const id = window.setInterval(() => {
      setProgressPercent((p) => (p >= cap ? p : Math.min(cap, p + 1)));
    }, 250);
    return () => window.clearInterval(id);
  }, [stage]);

  const run = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setError(null);
    setStage('downloading');
    setProgressPercent(0);

    try {
      const blob = await removeImageBackground(file, {
        onStage: (s) => setStage(s),
        // Always take the larger value — keeps the bar monotonic even when
        // real updates leapfrog over fake ticks (or vice versa).
        onProgress: (p) => setProgressPercent((prev) => Math.max(prev, p)),
      });
      setResult(blob);
      setProgressPercent(100);
      setStage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 배경 제거 중 오류가 발생했습니다.');
    }
  }, [file]);

  return { result, stage, progressPercent, error, run };
}
