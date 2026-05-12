import { useState, useCallback } from 'react';
import {
  removeImageBackground,
  type BackgroundRemovalStage,
} from '@/app/editor/_lib/backgroundRemoval';

export function useBackgroundRemoval(file: File | null): {
  result: Blob | null;
  stage: BackgroundRemovalStage | null;
  error: string | null;
  run: () => Promise<void>;
} {
  const [result, setResult] = useState<Blob | null>(null);
  const [stage, setStage] = useState<BackgroundRemovalStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setError(null);
    setStage('downloading');

    try {
      const blob = await removeImageBackground(file, {
        onStage: (s) => setStage(s),
      });
      setResult(blob);
      setStage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 배경 제거 중 오류가 발생했습니다.');
    }
  }, [file]);

  return { result, stage, error, run };
}
