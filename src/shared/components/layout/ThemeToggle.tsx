'use client';

import { useThemeStore } from '@/shared/hooks/useTheme';
import type { ThemeVersion } from '@/shared/types';

const OPTIONS: Array<{ value: ThemeVersion; label: string; sub: string }> = [
  { value: 'A', label: 'A', sub: '차분' },
  { value: 'B', label: 'B', sub: '키치' },
];

export function ThemeToggle() {
  const version = useThemeStore((s) => s.version);
  const setVersion = useThemeStore((s) => s.setVersion);

  return (
    <div
      role="radiogroup"
      aria-label="브랜드 톤 선택"
      className="inline-flex items-stretch bg-surface border-2 border-ink shadow-[2px_2px_0_#1A1714] font-mono text-[11px] font-bold tracking-[1px] select-none"
    >
      {OPTIONS.map((opt) => {
        const active = version === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => setVersion(opt.value)}
            title={opt.value === 'A' ? '차분한 사진관' : '키치 부스'}
            className={
              active
                ? 'px-2 sm:px-2.5 py-1 bg-ink text-surface whitespace-nowrap'
                : 'px-2 sm:px-2.5 py-1 text-ink hover:bg-ink/5 whitespace-nowrap'
            }
          >
            {opt.label}
            <span className="hidden sm:inline"> · {opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
