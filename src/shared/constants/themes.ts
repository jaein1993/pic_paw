// V3 brand-renewal design tokens. Mirrors VERSION_THEMES in
// design_handoff_pic-paw/brand.jsx — keep in sync when either side changes.
// Tailwind utilities resolve via the CSS vars in app/globals.css; this module
// exists for canvas/Konva and other JS contexts that can't read CSS vars.

export type ThemeVersion = 'A' | 'B';

export interface ThemeTokens {
  label: string;
  sub: string;
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  accent2: string;
  accent3: string;
  ctaBg: string;
  ctaInk: string;
  chipBg: string;
  headFont: string;
  headWeight: number;
  handFontWeight: number;
  borderWidth: string;
  shadow: string;
  curtain: string;
  photoBg: string;
}

export const THEMES: Record<ThemeVersion, ThemeTokens> = {
  A: {
    label: '차분한 사진관',
    sub: '현실 배경 + 베이지/검정/코랄',
    bg: '#F4EFE6',
    surface: '#ffffff',
    ink: '#1A1714',
    accent: '#E85A4F',
    accent2: '#D9C5A0',
    accent3: '#5A6B5D',
    ctaBg: '#1A1714',
    ctaInk: '#F4EFE6',
    chipBg: '#ffffff',
    headFont: '"Nanum Myeongjo", serif',
    headWeight: 800,
    handFontWeight: 400,
    borderWidth: '1px',
    shadow: '0 12px 30px -10px rgba(0,0,0,.25)',
    curtain: 'repeating-linear-gradient(0deg,#E85A4F 0 16px,#c8472e 16px 32px)',
    photoBg: 'linear-gradient(135deg,#5A6B5D55,#2a2520)',
  },
  B: {
    label: '키치 부스',
    sub: '단색 배경 + 노랑/핑크/민트',
    bg: '#FFE26A',
    surface: '#ffffff',
    ink: '#1A1714',
    accent: '#FF6B9D',
    accent2: '#7AD9C4',
    accent3: '#FFD93D',
    ctaBg: '#FF6B9D',
    ctaInk: '#1A1714',
    chipBg: '#FFD93D',
    headFont: '"Black Han Sans", sans-serif',
    headWeight: 400,
    handFontWeight: 700,
    borderWidth: '3px',
    shadow: '5px 5px 0 #1A1714',
    curtain: 'repeating-linear-gradient(0deg,#FF6B9D 0 16px,#ffb7d5 16px 32px)',
    photoBg: 'linear-gradient(135deg,#7AD9C4,#5fbfaa)',
  },
};

export const FONT_FAMILIES = {
  sans: 'Pretendard, system-ui, sans-serif',
  serif: '"Nanum Myeongjo", serif',
  display: '"Black Han Sans", sans-serif',
  hand: '"Gaegu", cursive',
  mono: '"Space Mono", monospace',
} as const;

export const DEFAULT_THEME: ThemeVersion = 'A';
