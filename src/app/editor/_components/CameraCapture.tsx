'use client';

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/app/editor/_hooks/useCamera';
import { Button } from '@/shared/components/ui/Button';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onCancel?: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const { videoRef, start, stop, capture, switchCamera, error } = useCamera('user');
  const [isStarted, setIsStarted] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start().then(() => setIsStarted(true));
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    const blob = await capture();
    if (blob) {
      stop();
      onCapture(blob);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="text-4xl">🚫</span>
        <p className="text-text-primary font-semibold">카메라 접근 권한이 필요합니다</p>
        <p className="text-text-secondary text-sm">
          브라우저 설정에서 카메라 권한을 허용해주세요.
          <br />
          또는 배경 사진을 직접 업로드하세요.
        </p>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            돌아가기
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!isStarted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-sm">카메라 시작 중...</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={handleCapture} variant="primary" disabled={!isStarted}>
          촬영하기
        </Button>
        <Button
          variant="secondary"
          onClick={() => { switchCamera(); start(); }}
        >
          전/후면 전환
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={() => { stop(); onCancel(); }}>
            취소
          </Button>
        )}
      </div>
    </div>
  );
}
