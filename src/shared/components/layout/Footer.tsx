import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink bg-surface">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[1.5px] text-ink/70">
          Pic_paw · 2026 · 시연용 MVP
        </p>
        <nav className="flex gap-5 text-sm font-head font-extrabold text-ink">
          <Link href="/about" className="hover:text-accent transition-colors">소개</Link>
          <Link href="/privacy" className="hover:text-accent transition-colors">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-accent transition-colors">이용약관</Link>
        </nav>
      </div>
      <div className="border-t border-ink/10">
        <p className="max-w-6xl mx-auto px-6 sm:px-10 py-3 text-center font-mono text-[10px] tracking-[1px] text-ink/50">
          team pic-paw — 김수빈 · 임재인 만듦
        </p>
      </div>
    </footer>
  );
}
