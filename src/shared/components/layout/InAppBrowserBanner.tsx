'use client';

import { useEffect, useState } from 'react';

type InAppKind = 'kakao' | 'naver' | 'instagram' | 'facebook' | 'line' | 'other';

function detectInApp(ua: string): InAppKind | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp|Whale\/.*Inapp/i.test(ua)) return 'naver';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/\bLine\//i.test(ua)) return 'line';
  // Generic Android WebView marker (used by many apps).
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return 'other';
  return null;
}

const LABELS: Record<InAppKind, string> = {
  kakao: '카카오톡',
  naver: '네이버',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
  other: '인앱',
};

const REDIRECT_FLAG = 'pic-paw:inapp-redirected';

export function InAppBrowserBanner() {
  const [kind, setKind] = useState<InAppKind | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const detected = detectInApp(ua);
    setKind(detected);
    const android = /Android/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsAndroid(android);
    setIsIOS(ios);

    // Android KakaoTalk exposes a force-external-browser URL scheme. Fire it
    // automatically once per session so the user is sent to Chrome / Samsung
    // Internet directly, no taps required.
    if (detected === 'kakao' && android) {
      const already = sessionStorage.getItem(REDIRECT_FLAG);
      if (!already) {
        sessionStorage.setItem(REDIRECT_FLAG, '1');
        const timer = setTimeout(() => {
          window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  if (!kind || dismissed) return null;

  const handlePrimaryAction = async () => {
    const url = window.location.href;
    if (kind === 'kakao' && isAndroid) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard blocked — user can long-press the address bar instead.
    }
  };

  const primaryLabel = copied
    ? '✓ URL 복사 완료!'
    : kind === 'kakao' && isAndroid
      ? '외부 브라우저로 이동'
      : 'URL 복사';

  return (
    <div className="fixed inset-0 z-[80] bg-ink/70 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-surface border-2 border-ink shadow-theme p-5 space-y-4">
        <div className="text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-head font-extrabold text-ink mt-2 leading-tight">
            외부 브라우저에서 열어주세요
          </h2>
          <p className="text-sm text-ink/70 mt-1">
            {LABELS[kind]} 안에선 손 인식·파일 저장이 안 돼요
          </p>
        </div>

        <div className="bg-chip-bg/40 border border-ink/20 p-3">
          {isIOS ? (
            <ol className="text-sm space-y-1.5 text-ink">
              <li>
                1. 아래 <b>'URL 복사'</b> 버튼 누르기
              </li>
              <li>
                2. <b>Safari</b> 앱 열기
              </li>
              <li>3. 주소창 길게 눌러 붙여넣기 → 이동</li>
            </ol>
          ) : (
            <ol className="text-sm space-y-1.5 text-ink">
              <li>
                1. 화면 우측 상단 <b>점 3개 메뉴 (⋮)</b> 누르기
              </li>
              <li>
                2. <b>'외부 브라우저로 열기'</b> 또는 <b>'다른 브라우저로'</b> 선택
              </li>
            </ol>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full px-4 py-3 bg-ink text-surface font-display text-lg border border-ink active:translate-y-px"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full text-xs text-ink/50 underline underline-offset-2 py-1"
          >
            그냥 계속 보기 (일부 기능 제한)
          </button>
        </div>
      </div>
    </div>
  );
}
