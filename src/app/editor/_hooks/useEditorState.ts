import { create } from 'zustand';
import type {
  EditorStep,
  EditorState,
  PetPosition,
  Shot,
  CutFrames,
} from '@/shared/types';
import { BORDERS } from '@/app/editor/_constants/borders';

// Dog defaults to the right side so the user (selfie, mirrored) appears on
// their own left and the dog on their right — matching the booth silhouette.
const INITIAL_PET_POSITION: PetPosition = { x: 0.72, y: 0.6 };

const INITIAL_BORDER_ID = BORDERS[0]?.id ?? null;

export const useEditorState = create<EditorState>((set) => ({
  currentStep: 1,
  petImageUrl: null,
  petOriginalFile: null,
  petPosition: { ...INITIAL_PET_POSITION },
  shots: [],
  cutFrames: [[], [], [], []],
  selectedBorderId: INITIAL_BORDER_ID,
  speechText: '',

  setStep: (step: EditorStep) => set({ currentStep: step }),
  setPetImageUrl: (url: string | null) => set({ petImageUrl: url }),
  setPetOriginalFile: (file: File | null) => set({ petOriginalFile: file }),
  setPetPosition: (pos: Partial<PetPosition>) =>
    set((state) => ({ petPosition: { ...state.petPosition, ...pos } })),
  pushShot: (shot: Shot) => set((state) => ({ shots: [...state.shots, shot] })),
  clearShots: () => set({ shots: [] }),
  setCutFrames: (cutIndex: number, frames: CutFrames) =>
    set((state) => {
      const next = [...state.cutFrames];
      next[cutIndex] = frames;
      return { cutFrames: next };
    }),
  clearCutFrames: () => set({ cutFrames: [[], [], [], []] }),
  setSelectedBorderId: (id: string | null) => set({ selectedBorderId: id }),
  setSpeechText: (s: string) => set({ speechText: s }),
  reset: () =>
    set({
      currentStep: 1,
      petImageUrl: null,
      petOriginalFile: null,
      petPosition: { ...INITIAL_PET_POSITION },
      shots: [],
      cutFrames: [[], [], [], []],
      selectedBorderId: INITIAL_BORDER_ID,
      speechText: '',
    }),
}));
