import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSizeLevel = 'small' | 'medium' | 'large';

interface FontSizeState {
  fontSize: FontSizeLevel;
  setFontSize: (level: FontSizeLevel) => void;
}

export const FONT_SIZE_MAP: Record<FontSizeLevel, number> = {
  small: 16,
  medium: 18,
  large: 20,
};

export const useFontSizeStore = create<FontSizeState>()(
  persist(
    (set) => ({
      fontSize: 'medium',
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: 'font-size-storage' }
  )
);
