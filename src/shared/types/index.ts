export type EditorStep = 1 | 2 | 3 | 4;

// A/B brand-renewal toggle. A = 차분한 사진관, B = 키치 부스.
export type ThemeVersion = 'A' | 'B';

// Strip cut arrangement. 1×4 = classic photo-booth column, 2×2 = grid
// that fits one phone screen at a glance.
export type CutLayout = '1x4' | '2x2';

// Downloaded strip frame color. Letter color is derived automatically for
// contrast (dark bg → cream text, light bg → dark text).
export type FrameColor = 'black' | 'white';

// Per-cut countdown seconds, picked by the user in Step 2 before entering
// the booth. Allow-listed values so a stray query string can't push the
// booth into an absurd duration.
export type CountdownSeconds = 5 | 7 | 10 | 15;
export const COUNTDOWN_OPTIONS: readonly CountdownSeconds[] = [5, 7, 10, 15];

// Pet position relative to the camera viewport. (x, y) is the pet node's center,
// normalized to 0..1 of the square viewport edge.
export interface PetPosition {
  x: number;
  y: number;
}

// 4-cut booth decoration kind, fixed per cell index (0..3).
// Decorations (sunglasses/speech/heart) are intentionally disabled for the
// current build — the assets stay in the codebase so they can be re-enabled
// per-cell without rewriting the overlay pipeline.
export type DecorationKind = 'plain' | 'sunglasses' | 'speech' | 'heart';

export const CELL_DECORATIONS: readonly DecorationKind[] = [
  'plain',
  'plain',
  'plain',
  'plain',
];

// One captured shot from the booth.
export interface Shot {
  // Composited (camera + pet) PNG dataURL, square (720x720).
  dataUrl: string;
  // Pet position (normalized) at the moment of capture. Debug/decoration anchor.
  petPosition: PetPosition;
  capturedAt: number;
}

// Outer strip border style.
export interface BorderStyle {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
}

// Per-cut animated frames captured during the 5-second countdown.
// Each cut holds ~40 canvases (8fps × 5s) at small resolution for GIF/WebM.
export type CutFrames = HTMLCanvasElement[];

export interface EditorState {
  currentStep: EditorStep;
  petImageUrl: string | null;
  petOriginalFile: File | null;
  petPosition: PetPosition;
  shots: Shot[];
  cutFrames: CutFrames[];
  selectedBorderId: string | null;
  speechText: string;
  cutLayout: CutLayout;
  frameColor: FrameColor;
  countdownSeconds: CountdownSeconds;
  setStep: (step: EditorStep) => void;
  setPetImageUrl: (url: string | null) => void;
  setPetOriginalFile: (file: File | null) => void;
  setPetPosition: (pos: Partial<PetPosition>) => void;
  pushShot: (shot: Shot) => void;
  clearShots: () => void;
  setCutFrames: (cutIndex: number, frames: CutFrames) => void;
  clearCutFrames: () => void;
  setSelectedBorderId: (id: string | null) => void;
  setSpeechText: (s: string) => void;
  setCutLayout: (layout: CutLayout) => void;
  setFrameColor: (color: FrameColor) => void;
  setCountdownSeconds: (n: CountdownSeconds) => void;
  reset: () => void;
}
