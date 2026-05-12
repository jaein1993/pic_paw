'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { startCamera } from '@/app/editor/_lib/camera';
import { Button } from '@/shared/components/ui/Button';
import { COUNTDOWN_OPTIONS } from '@/shared/types';

export function BackgroundChoice() {
  const { setStep, countdownSeconds, setCountdownSeconds } = useEditorState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the SHARED stream from camera.ts. First call here triggers the one
  // and only permission prompt; Step 3 reuses the same stream when the user
  // advances. Don't stop the stream on unmount — it stays alive for the
  // booth (released only when leaving /editor entirely).
  useEffect(() => {
    let cancelled = false;
    const v = videoRef.current;
    if (!v) return;
    (async () => {
      try {
        await startCamera(v, 'user');
        if (!cancelled) setGranted(true);
      } catch {
        if (!cancelled) setError('카메라 권한이 필요합니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <header className="text-center">
        <h2 className="text-xl font-bold text-text-primary">부스 입장 준비</h2>
        <p className="text-text-secondary text-sm mt-1">
          카메라 화면이 잘 잡히는지 확인하고 부스에 입장하세요.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          {error} — 브라우저 설정에서 카메라 권한을 허용해주세요.
        </div>
      )}

      <div className="aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-black relative border-2 border-ink shadow-theme">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {!granted && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            카메라 권한 요청 중...
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-mono text-xs tracking-wider text-text-secondary">
          컷당 촬영 시간
        </span>
        <div role="radiogroup" aria-label="컷당 촬영 시간" className="flex gap-1.5">
          {COUNTDOWN_OPTIONS.map((sec) => {
            const active = countdownSeconds === sec;
            return (
              <button
                key={sec}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCountdownSeconds(sec)}
                className={
                  active
                    ? 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-ink text-surface border-2 border-ink'
                    : 'px-3 py-1.5 text-xs font-mono font-bold tracking-wider bg-surface text-ink border-2 border-ink hover:bg-ink/5'
                }
              >
                {sec}초
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setStep(1)}>
          ← 이전
        </Button>
        <Button variant="primary" disabled={!granted} onClick={() => setStep(3)}>
          부스 입장 →
        </Button>
      </div>
    </div>
  );
}
