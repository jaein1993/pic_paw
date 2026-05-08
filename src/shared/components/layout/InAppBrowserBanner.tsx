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

function isAndroid(ua: string): boolean {
  return /Android/i.test(ua);
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
  const [android, setAndroid] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const detected = detectInApp(ua);
    setKind(detected);
    const isAnd = isAndroid(ua);
    setAndroid(isAnd);

    // Android KakaoTalk exposes a force-external-browser URL scheme. Fire it
    // automatically once per session so the user doesn't have to tap the
    // banner button — they just get sent to Chrome/Samsung Internet directly.
    if (detected === 'kakao' && isAnd) {
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

  const handleOpenExternal = async () => {
    const url = window.location.href;
    // KakaoTalk on Android exposes a scheme that forces the default browser.
    if (kind === 'kakao' && android) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    // Everything else: copy URL and instruct.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — user can long-press the address bar instead.
    }
  };

  return (
    <div className="sticky top-0 z-[60] bg-accent text-cta-ink border-b-2 border-ink px-4 py-2.5 text-sm flex items-center gap-3 shadow-[0_2px_0_#1A1714]">
      <span className="font-bold leading-tight">
        📱 {LABELS[kind]} 브라우저는 손 인식이 안 돼요.
      </span>
      <button
        type="button"
        onClick={handleOpenExternal}
        className="ml-auto shrink-0 px-3 py-1.5 bg-ink text-surface font-mono text-xs font-bold border border-ink hover:opacity-90"
      >
        {copied ? 'URL 복사됨!' : kind === 'kakao' && android ? '외부 브라우저 →' : 'URL 복사'}
      </button>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setDismissed(true)}
        className="shrink-0 px-2 text-ink/70 hover:text-ink text-base"
      >
        ✕
      </button>
    </div>
  );
}
