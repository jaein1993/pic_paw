// Inline SVG strings for the V3 decorations (sunglasses, heart pin, speech
// bubble). Mirrors the designs in design_handoff_pic-paw/decor.jsx so the
// live booth preview and the final strip share the exact same artwork.
//
// The SVGs are loaded into Konva via a data URL → useImage, so they composite
// into both the on-screen preview AND the `stage.toDataURL()` capture.

const ESCAPE_RE = /[<>&"']/g;
const ESCAPE_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(s: string): string {
  return s.replace(ESCAPE_RE, (c) => ESCAPE_MAP[c]);
}

export const SUNGLASSES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">
  <defs>
    <linearGradient id="lensL" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3a4a6b"/>
      <stop offset="100%" stop-color="#0f1420"/>
    </linearGradient>
    <linearGradient id="lensR" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3a4a6b"/>
      <stop offset="100%" stop-color="#0f1420"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-4 60 30)">
    <path d="M 4 20 Q 10 18 14 22" stroke="#1A1714" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 116 20 Q 110 18 106 22" stroke="#1A1714" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 8 16 L 52 14 L 56 42 L 18 44 Z" fill="url(#lensL)" stroke="#1A1714" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 64 14 L 108 16 L 102 44 L 64 42 Z" fill="url(#lensR)" stroke="#1A1714" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 52 18 Q 60 14 64 18" stroke="#1A1714" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 14 22 L 24 20 L 22 30 Z" fill="#fff" opacity="0.35"/>
    <path d="M 70 22 L 80 20 L 78 30 Z" fill="#fff" opacity="0.35"/>
  </g>
</svg>`;

export const SUNGLASSES_ASPECT = 120 / 60; // width / height

export const HEART_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">
  <defs>
    <radialGradient id="heartG" cx="35%" cy="30%">
      <stop offset="0%" stop-color="#FF8A7A"/>
      <stop offset="60%" stop-color="#E85A4F"/>
      <stop offset="100%" stop-color="#A8392F"/>
    </radialGradient>
  </defs>
  <g transform="rotate(-8 50 75)">
    <ellipse cx="52" cy="138" rx="12" ry="3" fill="rgba(0,0,0,0.25)"/>
    <line x1="50" y1="58" x2="50" y2="135" stroke="#888" stroke-width="2.5"/>
    <line x1="50" y1="58" x2="50" y2="135" stroke="#fff" stroke-width="0.8" opacity="0.6"/>
    <path d="M 50 56 C 30 38 14 38 14 24 C 14 12 26 6 38 14 C 44 18 48 24 50 28 C 52 24 56 18 62 14 C 74 6 86 12 86 24 C 86 38 70 38 50 56 Z" fill="url(#heartG)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="34" cy="20" rx="6" ry="3" fill="#fff" opacity="0.6" transform="rotate(-30 34 20)"/>
    <circle cx="50" cy="58" r="5" fill="#E9B949" stroke="#1A1714" stroke-width="1.5"/>
    <circle cx="48" cy="56" r="1.5" fill="#fff" opacity="0.7"/>
  </g>
</svg>`;

export const HEART_PIN_ASPECT = 100 / 150;

// Speech bubble carries user-supplied text — generated lazily so the data URL
// changes when text changes (so useImage reloads the SVG).
export function buildSpeechBubbleSvg(text: string): string {
  const lines = text.trim() ? text.split('\n').slice(0, 2) : [];
  const tspans = lines
    .map(
      (line, i) =>
        `<text x="98" y="${42 + i * 28}" text-anchor="middle" font-size="22" fill="#1A1714" font-family="Gaegu, 'Nanum Pen Script', cursive" font-weight="700">${escapeXml(
          line
        )}</text>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
  <g transform="rotate(-3 100 70)">
    <path d="M 14 16 Q 14 8 22 8 L 178 8 Q 186 8 186 16 L 186 88 Q 186 96 178 96 L 70 96 L 56 116 L 60 96 L 22 96 Q 14 96 14 88 Z" fill="rgba(26,23,20,0.15)" transform="translate(3,3)"/>
    <path d="M 12 14 Q 12 6 20 6 L 176 6 Q 184 6 184 14 L 184 86 Q 184 94 176 94 L 68 94 L 54 114 L 58 94 L 20 94 Q 12 94 12 86 Z" fill="#FFFDF6" stroke="#1A1714" stroke-width="3.5" stroke-linejoin="round"/>
    ${tspans}
  </g>
</svg>`;
}

export const SPEECH_BUBBLE_ASPECT = 200 / 140;

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
