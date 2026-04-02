import { createContext, useContext } from 'react';

import type { ThemeMode } from './themeMode.types';

export type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
};

export const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export const useThemeMode = (): ThemeModeContextValue => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
};
