'use client';

import { Spinner } from '@/shared/components/ui/Spinner';

interface BackgroundRemovalProgressProps {
  progress: number;
  isFirstUse?: boolean;
}

export function BackgroundRemovalProgress({
  progress,
  isFirstUse = false,
}: BackgroundRemovalProgressProps) {
  return (
    <div className="w-full flex flex-col items-center gap-4 py-10 px-4">
      <Spinner size="lg" className="text-brand-primary" />

      <div className="text-center">
        <p className="font-semibold text-text-primary text-lg">AI 배경 제거 중...</p>
        {isFirstUse && (
          <p className="text-sm text-text-secondary mt-1">
            AI 모델 다운로드 중... 약 25MB (첫 사용 시에만)
          </p>
        )}
      </div>

      <div className="w-full max-w-xs">
        <div className="h-2 bg-black/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-sm text-text-secondary mt-2">{progress}%</p>
      </div>

      <p className="text-xs text-text-secondary text-center max-w-xs">
        사진은 서버로 전송되지 않아요. 모든 처리는 내 기기에서 이루어집니다.
      </p>
    </div>
  );
}
