import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';
import { KEY, LEGACY_KEYS, type ThemeMode } from './themeMode.types';
import { ThemeModeContext } from './themeModeContext';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
};

const normalizeThemeMode = (value: string | null): ThemeMode | null => {
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value;
  }
  if (value === 'system') {
    return 'auto';
  }
  return null;
};

const readStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'auto';
  }

  const stored = normalizeThemeMode(window.localStorage.getItem(KEY));
  if (stored) {
    return stored;
  }

  for (const legacyKey of LEGACY_KEYS) {
    const legacyValue = normalizeThemeMode(window.localStorage.getItem(legacyKey));
    if (legacyValue) {
      return legacyValue;
    }
  }

  return 'auto';
};

const resolveThemeMode = (mode: ThemeMode, systemTheme: 'light' | 'dark'): 'light' | 'dark' =>
  mode === 'auto' ? systemTheme : mode;

const applyThemeToDocument = (resolvedMode: 'light' | 'dark') => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = resolvedMode;
  document.documentElement.classList.remove('g-root_theme_light', 'g-root_theme_dark');
  document.documentElement.classList.add(`g-root_theme_${resolvedMode}`);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolvedMode === 'dark' ? '#1c1c1e' : '#ffffff');
  }
};

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, next);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    const handleThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== KEY) {
        return;
      }

      if (event.newValue === null) {
        // Key was removed in another tab — revert to stored/default
        setModeState(readStoredMode());
        return;
      }

      const nextMode = normalizeThemeMode(event.newValue);
      if (nextMode) {
        setModeState(nextMode);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const resolvedMode = useMemo(() => resolveThemeMode(mode, systemTheme), [mode, systemTheme]);

  useEffect(() => {
    applyThemeToDocument(resolvedMode);
  }, [resolvedMode]);

  const contextValue = useMemo(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={resolvedMode}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
};
