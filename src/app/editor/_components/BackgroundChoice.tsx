'use client';

import { useEffect, useState } from 'react';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { useCamera } from '@/app/editor/_hooks/useCamera';
import { Button } from '@/shared/components/ui/Button';

export function BackgroundChoice() {
  const { setStep } = useEditorState();
  const camera = useCamera();
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    camera.start().then(() => {
      if (!cancelled) setGranted(true);
    });
    return () => {
      cancelled = true;
      camera.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-text-primary">카메라 준비</h2>
        <p className="text-text-secondary text-sm mt-1">
          pic-paw 부스에 입장합니다. 카메라 권한이 필요해요.
        </p>
      </header>

      {camera.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          {camera.error} — 브라우저 설정에서 카메라 권한을 허용해주세요.
        </div>
      )}

      <div className="aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-black relative">
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!granted && !camera.error && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            카메라 권한 요청 중...
          </div>
        )}
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
