/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (next: ThemeMode) => void;
};

const KEY = 'portal_theme_preference';

const getInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>('light');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      setResolvedMode(mql.matches ? 'dark' : 'light');
    };

    apply();
    mql.addEventListener('change', apply);
    return () => {
      mql.removeEventListener('change', apply);
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, next);
    }
  }, []);

  const contextValue = useMemo(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  );
  const theme = mode === 'system' ? resolvedMode : mode;

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = (): ThemeModeContextValue => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
};
