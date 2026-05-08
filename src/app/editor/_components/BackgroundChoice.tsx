'use client';

import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { Button } from '@/shared/components/ui/Button';

export function BackgroundChoice() {
  const { setStep } = useEditorState();

  // Camera is intentionally NOT started here — Step 3 (Compose) handles the
  // full camera lifecycle. Starting it twice (here AND there) caused some
  // browsers (esp. iOS Safari, KakaoTalk) to ask for camera permission a
  // second time when the user advances to the booth.
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <header className="text-center">
        <h2 className="text-xl font-bold text-text-primary">부스 입장 준비</h2>
        <p className="text-text-secondary text-sm mt-1">
          다음에서 카메라 권한을 한 번 요청해요. <b>"허용"</b>을 눌러주세요.
        </p>
      </header>

      <div className="bg-chip-bg/40 border border-ink/15 px-4 py-4 text-sm text-ink space-y-1.5">
        <p className="font-bold mb-1">📸 부스에서</p>
        <p>· 손바닥으로 강아지 위치 이동</p>
        <p>· 엄지·검지 거리로 크기 조정</p>
        <p>· 10초 카운트다운으로 4컷 자동 촬영</p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setStep(1)}>
          ← 이전
        </Button>
        <Button variant="primary" onClick={() => setStep(3)}>
          부스 입장 →
        </Button>
      </div>
    </div>
  );
}
