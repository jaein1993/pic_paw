'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import type { ThemeVersion } from '@/shared/types';
import { THEMES } from '@/shared/constants/themes';

interface ThemeStore {
  version: ThemeVersion;
  setVersion: (v: ThemeVersion) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  version: 'A',
  setVersion: (v) => set({ version: v }),
}));

// Sync the active version into <html data-theme="…"> so Tailwind utilities
// resolve via the CSS variables in globals.css.
export function ThemeSync() {
  const version = useThemeStore((s) => s.version);
  useEffect(() => {
    document.documentElement.dataset.theme = version;
  }, [version]);
  return null;
}

export function useTheme() {
  const version = useThemeStore((s) => s.version);
  return { version, tokens: THEMES[version] };
}
