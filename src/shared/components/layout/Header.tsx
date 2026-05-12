'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-10 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 select-none min-w-0">
          <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden className="shrink-0">
            <rect x="3" y="3" width="30" height="30" rx="6" fill="#FFD93D" stroke="#1A1714" strokeWidth="2.5" />
            <text x="18" y="15" textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="6" fill="#1A1714" letterSpacing="0.5" fontWeight="700">PET</text>
            <text x="18" y="28" textAnchor="middle" fontFamily="Black Han Sans, sans-serif" fontSize="14" fill="#1A1714">4컷</text>
          </svg>
          <span className="font-display text-lg sm:text-xl text-ink tracking-tight leading-none">
            Pic-paw
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-ink font-head font-extrabold">
          <Link href="/about" className="hover:text-accent transition-colors">소개</Link>
          <Link href="/privacy" className="hover:text-accent transition-colors">개인정보</Link>
          <Link href="#faq" className="hover:text-accent transition-colors">FAQ</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-display tracking-tight whitespace-nowrap bg-cta-bg text-cta-ink border border-ink shadow-theme hover:-translate-y-px active:translate-y-px transition-transform"
          >
            시작하기 <span aria-hidden>▶</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
