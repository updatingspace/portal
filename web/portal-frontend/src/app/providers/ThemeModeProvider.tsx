import React, { useCallback, useMemo, useState } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';
import { KEY, type ThemeMode } from './themeMode.types';
import { ThemeModeContext } from './themeModeContext';

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = window.localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'light';
  });

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, next);
    }
  }, []);

  const contextValue = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={mode}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
};
