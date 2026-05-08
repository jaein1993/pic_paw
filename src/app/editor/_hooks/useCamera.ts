import { useRef, useState, useCallback } from 'react';
import {
  startCamera,
  stopStream,
  captureFrame,
  getOppositeCamera,
} from '@/app/editor/_lib/camera';

export function useCamera(facing: 'user' | 'environment' = 'user'): {
  videoRef: React.RefObject<HTMLVideoElement>;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<Blob | null>;
  switchCamera: () => void;
  error: string | null;
} {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(facing);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!videoRef.current) return;
      stopStream(streamRef.current);
      streamRef.current = await startCamera(videoRef.current, facingMode);
    } catch {
      setError('카메라 접근 권한이 필요합니다.');
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const capture = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current) return null;
    return captureFrame(videoRef.current);
  }, []);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => getOppositeCamera(prev));
    // The component should call start() again after switching
    stop();
  }, [stop]);

  return { videoRef, start, stop, capture, switchCamera, error };
}
