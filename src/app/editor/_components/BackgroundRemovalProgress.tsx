'use client';

import { Spinner } from '@/shared/components/ui/Spinner';
import type { BackgroundRemovalStage } from '@/app/editor/_lib/backgroundRemoval';

interface BackgroundRemovalProgressProps {
  stage: BackgroundRemovalStage | null;
  isFirstUse?: boolean;
}

export function BackgroundRemovalProgress({
  stage,
  isFirstUse = false,
}: BackgroundRemovalProgressProps) {
  const title =
    stage === 'downloading' ? 'AI 모델 다운로드 중…' : 'AI 배경 분석 중…';
  const sub =
    stage === 'downloading' && isFirstUse
      ? '약 10MB · 첫 사용 시에만'
      : '잠시만 기다려주세요';

  return (
    <div className="w-full flex flex-col items-center gap-4 py-10 px-4">
      <Spinner size="lg" className="text-brand-primary" />

      <div className="text-center">
        <p className="font-semibold text-text-primary text-lg">{title}</p>
        <p className="text-sm text-text-secondary mt-1">{sub}</p>
      </div>

      <p className="text-xs text-text-secondary text-center max-w-xs">
        사진은 서버로 전송되지 않아요. 모든 처리는 내 기기에서 이루어집니다.
      </p>
    </div>
  );
}
