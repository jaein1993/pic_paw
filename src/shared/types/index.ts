export type EditorStep = 1 | 2 | 3 | 4;

// A/B brand-renewal toggle. A = 차분한 사진관, B = 키치 부스.
export type ThemeVersion = 'A' | 'B';

// Pet position relative to the camera viewport. (x, y) is the pet node's center,
// normalized to 0..1 of the square viewport edge.
export interface PetPosition {
  x: number;
  y: number;
}

// 4-cut booth decoration kind, fixed per cell index (0..3).
export type DecorationKind = 'plain' | 'sunglasses' | 'speech' | 'heart';

export const CELL_DECORATIONS: readonly DecorationKind[] = [
  'plain',
  'sunglasses',
  'speech',
  'heart',
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

export interface EditorState {
  currentStep: EditorStep;
  petImageUrl: string | null;
  petOriginalFile: File | null;
  petPosition: PetPosition;
  shots: Shot[];
  selectedBorderId: string | null;
  speechText: string;
  setStep: (step: EditorStep) => void;
  setPetImageUrl: (url: string | null) => void;
  setPetOriginalFile: (file: File | null) => void;
  setPetPosition: (pos: Partial<PetPosition>) => void;
  pushShot: (shot: Shot) => void;
  clearShots: () => void;
  setSelectedBorderId: (id: string | null) => void;
  setSpeechText: (s: string) => void;
  reset: () => void;
}
