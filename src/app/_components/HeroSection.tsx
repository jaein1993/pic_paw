import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-canvas">
      {/* paper grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(0,0,0,.025) 1px, transparent 2px), radial-gradient(circle at 80% 60%, rgba(0,0,0,.02) 1px, transparent 2px)',
          backgroundSize: '6px 6px, 9px 9px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-12 pb-16 lg:pt-16 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-12 items-start">
        {/* Left: copy */}
        <div className="lg:pt-10">
          <span className="inline-flex items-center gap-2 mb-7 px-2.5 py-1 font-mono text-[11px] tracking-[0.2em] text-ink bg-accent-2 border-[2.5px] border-ink shadow-[3px_3px_0_#1A1714] -rotate-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            우리집 강아지랑 부스 한 컷 ★
          </span>

          <h1 className="font-head font-extrabold text-ink leading-[0.95] tracking-[-0.04em] mb-6 text-[56px] sm:text-[72px] lg:text-[88px]">
            너랑 나랑,<br />
            오늘의<br />
            <span className="relative inline-block">
              네 컷
              <svg
                aria-hidden
                className="absolute -left-2 -bottom-1 -z-10 w-[110%] h-5"
                viewBox="0 0 220 20"
                preserveAspectRatio="none"
              >
                <path
                  d="M 4 12 Q 60 4 120 12 T 216 10"
                  stroke="var(--color-accent)"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </svg>
            </span>
          </h1>

          <p className="text-[17px] leading-[1.7] text-ink/80 max-w-md mb-9">
            집에서 강아지 사진 한 장 올리고,<br />
            웹캠으로 셀카 4번. 우리 둘이 같이 찍은<br />
            사진 부스 한 장이 인쇄돼요.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/editor"
              className="inline-flex items-center gap-3 px-6 py-3.5 font-display text-[22px] tracking-tight bg-cta-bg text-cta-ink border border-ink shadow-theme hover:-translate-y-0.5 active:translate-y-0.5 transition-transform"
            >
              부스 입장하기 <span aria-hidden>▶</span>
            </Link>
            <div className="relative font-hand text-lg text-ink -rotate-[4deg] pl-6 hidden sm:block">
              회원가입 X · 60초 컷
              <svg aria-hidden className="absolute -left-2 top-2" width="32" height="32" viewBox="0 0 32 32">
                <path d="M 28 24 Q 16 28 8 16" stroke="#1A1714" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M 8 16 L 12 14 M 8 16 L 10 20" stroke="#1A1714" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right: diagonal mini-strips */}
        <div className="relative min-h-[480px] lg:min-h-[600px] hidden md:block">
          <div className="absolute top-10 left-12 -rotate-[6deg]">
            <MiniStrip variant="mint" />
          </div>
          <div className="absolute top-0 right-6 rotate-[4deg]">
            <MiniStrip variant="pink" />
          </div>
          {/* tape */}
          <div
            aria-hidden
            className="absolute -top-2 right-24 w-[70px] h-6 bg-[#FFD93D] border-2 border-ink shadow-[2px_2px_0_#1A1714] -rotate-[12deg]"
          />
          {/* paw stamps */}
          <PawPrint className="absolute bottom-20 left-0 -rotate-[20deg] opacity-40" size={28} />
          <PawPrint className="absolute bottom-8 right-72 rotate-[15deg] opacity-40" size={20} />
          {/* handwritten arrow */}
          <div className="absolute bottom-10 left-16 font-hand font-bold text-lg text-ink -rotate-[6deg] leading-tight">
            ← 이런 사진이<br />
            &nbsp;&nbsp;나와요!
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStrip({ variant }: { variant: 'pink' | 'mint' }) {
  const bgClass = variant === 'pink' ? 'bg-accent' : 'bg-accent-2';
  return (
    <div className={`w-[200px] ${bgClass} border border-ink shadow-theme p-3 pb-2.5`}>
      <div className="text-center font-head font-extrabold text-base text-ink tracking-tight pb-2 mb-2 border-b-2 border-dashed border-ink">
        ★ Pic-paw ★
      </div>
      <div className="bg-surface border-2 border-ink p-1 flex flex-col gap-[3px]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border-[1.5px] border-ink">
            <PhotoCell idx={i} />
          </div>
        ))}
      </div>
      <div className="text-center font-mono font-bold text-[8px] tracking-[1.5px] text-ink pt-2 mt-2">
        2026.05.07 · NO.0042
      </div>
    </div>
  );
}

function PhotoCell({ idx }: { idx: number }) {
  const dogColors = ['#D9C5A0', '#C8A878', '#8B6F47', '#5A6B5D'];
  return (
    <div className="relative w-full h-[120px] overflow-hidden bg-[#2a2520]">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${dogColors[idx % 4]}55 0%, #2a2520 100%)` }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 14px, rgba(255,255,255,.08) 14px 28px)',
        }}
      />
      <span className="absolute left-3 top-2 font-mono text-[10px] tracking-wider text-white/50">
        SELFIE + DOG · #{String(idx).padStart(2, '0')}
      </span>
      <svg viewBox="0 0 280 280" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="100" cy="120" rx="48" ry="56" fill="rgba(255,255,255,.18)" />
        <rect x="50" y="170" width="100" height="120" rx="50" fill="rgba(255,255,255,.18)" />
        <ellipse cx="200" cy="160" rx="38" ry="36" fill="rgba(255,255,255,.28)" />
        <ellipse cx="180" cy="135" rx="10" ry="14" fill="rgba(255,255,255,.28)" />
        <ellipse cx="220" cy="135" rx="10" ry="14" fill="rgba(255,255,255,.28)" />
        <rect x="170" y="180" width="60" height="80" rx="28" fill="rgba(255,255,255,.28)" />
      </svg>
    </div>
  );
}

function PawPrint({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <ellipse cx="20" cy="26" rx="9" ry="8" fill="#1A1714" />
      <ellipse cx="9" cy="14" rx="3.5" ry="5" fill="#1A1714" />
      <ellipse cx="31" cy="14" rx="3.5" ry="5" fill="#1A1714" />
      <ellipse cx="14" cy="6" rx="3" ry="4" fill="#1A1714" />
      <ellipse cx="26" cy="6" rx="3" ry="4" fill="#1A1714" />
    </svg>
  );
}
