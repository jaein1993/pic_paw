'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

interface FileDropzoneProps {
  accept?: string;
  maxSize?: number;
  onUpload: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
}

export function FileDropzone({
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024,
  onUpload,
  children,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드할 수 있어요.');
        return;
      }
      if (file.size > maxSize) {
        setError(`파일 크기는 ${Math.round(maxSize / 1024 / 1024)}MB 이하여야 해요.`);
        return;
      }
      onUpload(file);
    },
    [maxSize, onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'w-full min-h-[220px] rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 p-8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
          isDragging
            ? 'border-brand-primary bg-brand-primary/5'
            : 'border-black/20 hover:border-brand-primary hover:bg-brand-primary/5'
        )}
        aria-label="이미지 파일 업로드"
      >
        <span className="text-5xl">{isDragging ? '📂' : '📁'}</span>
        <div className="text-center">
          <p className="font-semibold text-text-primary">
            {children ?? '파일을 끌어다 놓거나 클릭해서 선택'}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            JPG, PNG, WEBP 등 이미지 파일 ({Math.round(maxSize / 1024 / 1024)}MB 이하)
          </p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onInputChange}
        data-testid="file-input"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
