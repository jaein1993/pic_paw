import { useState, useCallback } from 'react';
import { removeImageBackground } from '@/app/editor/_lib/backgroundRemoval';

export function useBackgroundRemoval(file: File | null): {
  result: Blob | null;
  progressPercent: number;
  error: string | null;
  run: () => Promise<void>;
} {
  const [result, setResult] = useState<Blob | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setError(null);
    setProgressPercent(0);

    try {
      const blob = await removeImageBackground(file, {
        onProgress: (n) => setProgressPercent(n),
      });
      setResult(blob);
      setProgressPercent(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 배경 제거 중 오류가 발생했습니다.');
    }
  }, [file]);

  return { result, progressPercent, error, run };
}
