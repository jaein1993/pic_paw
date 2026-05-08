'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useEditorState } from '@/app/editor/_hooks/useEditorState';
import { useBackgroundRemoval } from '@/app/editor/_hooks/useBackgroundRemoval';
import { resizeImage } from '@/app/editor/_lib/imageResize';
import { FileDropzone } from './FileDropzone';
import { BackgroundRemovalProgress } from './BackgroundRemovalProgress';
import { Button } from '@/shared/components/ui/Button';

export function Step1_PetUpload() {
  const { petImageUrl, petOriginalFile, setPetImageUrl, setPetOriginalFile, setStep } =
    useEditorState();
  const [pendingFile, setPendingFile] = useState<File | null>(petOriginalFile);
  const [isFirstUse, setIsFirstUse] = useState(false);
  const { result, progressPercent, error, run } = useBackgroundRemoval(pendingFile);
  const resultUrlRef = useRef<string | null>(null);

  const handleUpload = async (file: File) => {
    setPetOriginalFile(file);
    // Resize to max 2048px before passing to background removal
    const resized = await resizeImage(file, 2048);
    const resizedFile = new File([resized], file.name, { type: 'image/png' });
    setPendingFile(resizedFile);
  };

  useEffect(() => {
    if (pendingFile && !petImageUrl) {
      setIsFirstUse(true);
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile]);

  useEffect(() => {
    if (result) {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(result);
      resultUrlRef.current = url;
      setPetImageUrl(url);
    }
  }, [result, setPetImageUrl]);

  const handleReset = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setPendingFile(null);
    setPetOriginalFile(null);
    setPetImageUrl(null);
  };

  const isProcessing = !!pendingFile && !petImageUrl && !error;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">반려동물 사진 업로드</h2>
        <p className="text-text-secondary mt-1">
          AI가 자동으로 배경을 제거해드려요. (첫 사용 시 약 25MB 모델 다운로드)
        </p>
      </div>

      {!petImageUrl && !isProcessing && (
        <FileDropzone
          onUpload={handleUpload}
          maxSize={10 * 1024 * 1024}
        >
          반려동물 사진을 끌어다 놓거나 클릭해서 선택
        </FileDropzone>
      )}

      {isProcessing && (
        <BackgroundRemovalProgress
          progress={progressPercent}
          isFirstUse={isFirstUse}
        />
      )}

      {error && (
        <div className="text-center space-y-3" data-testid="step1-error">
          <p className="text-red-500">{error}</p>
          <Button variant="ghost" onClick={handleReset}>
            다시 시도
          </Button>
        </div>
      )}

      {petImageUrl && !isProcessing && (
        <div className="flex flex-col items-center gap-4 w-full" data-testid="step1-result">
          <div
            className="relative w-full max-w-sm h-64 rounded-2xl overflow-hidden border border-black/10"
            style={{
              backgroundImage:
                'repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 20px 20px',
            }}
          >
            <Image
              src={petImageUrl}
              alt="배경 제거된 반려동물"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-sm text-text-secondary">배경이 제거됐어요!</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button
              onClick={() => setStep(2)}
              data-testid="step1-next"
            >
              다음 단계로
            </Button>
            <Button variant="ghost" onClick={handleReset} data-testid="step1-reset">
              다시 업로드
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
