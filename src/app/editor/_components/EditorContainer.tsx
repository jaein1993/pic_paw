'use client';

import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { Header } from '@/shared/components/layout/Header';
import { Step1_PetUpload } from './Step1_PetUpload';
import { Step2_BackgroundChoice } from './Step2_BackgroundChoice';
import { Step3_Compose } from './Step3_Compose';
import { Step4_FrameDownload } from './Step4_FrameDownload';
import { cn } from '@/shared/lib/utils';

const STEP_LABELS = [
  { n: 1, label: '사진 업로드' },
  { n: 2, label: '배경 선택' },
  { n: 3, label: '합성 조정' },
  { n: 4, label: '저장' },
];

export default function EditorContainer() {
  const { currentStep, setStep } = useEditorState();

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header />

      <div className="sticky top-16 z-30 bg-surface border-b border-ink">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {STEP_LABELS.map(({ n, label }, i) => (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-8 h-8 flex items-center justify-center text-sm font-mono font-bold border-2 transition-all',
                      currentStep === n
                        ? 'bg-ink text-surface border-ink'
                        : currentStep > n
                        ? 'bg-chip-bg text-ink border-ink cursor-pointer'
                        : 'bg-surface text-ink/40 border-ink/30'
                    )}
                    onClick={() => {
                      if (currentStep > n) setStep(n as 1 | 2 | 3 | 4);
                    }}
                    role={currentStep > n ? 'button' : undefined}
                    tabIndex={currentStep > n ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && currentStep > n) setStep(n as 1 | 2 | 3 | 4);
                    }}
                  >
                    {currentStep > n ? '✓' : String(n).padStart(2, '0')}
                  </div>
                  <span
                    className={cn(
                      'text-xs hidden sm:block font-head',
                      currentStep === n ? 'text-ink font-extrabold' : 'text-ink/60'
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 transition-all',
                      currentStep > n ? 'bg-ink' : 'bg-ink/20'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:px-6">
        {currentStep === 1 && <Step1_PetUpload />}
        {currentStep === 2 && <Step2_BackgroundChoice />}
        {currentStep === 3 && <Step3_Compose />}
        {currentStep === 4 && <Step4_FrameDownload />}
      </main>
    </div>
  );
}
