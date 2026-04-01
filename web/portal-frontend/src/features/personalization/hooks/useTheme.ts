/**
 * useTheme - Hook for theme management with system preference detection
 */
import { useCallback, useEffect, useState } from 'react';

import type { Theme } from '../types';

const THEME_STORAGE_KEY = 'updspace-theme';

export interface UseThemeOptions {
  /** Initial theme preference (default: 'auto') */
  initialTheme?: Theme;
  /** Storage key for persistence (default: 'updspace-theme') */
  storageKey?: string;
}

export interface UseThemeReturn {
  /** Current theme preference (light/dark/auto) */
  theme: Theme;
  /** Resolved theme (light/dark) after applying auto detection */
  resolvedTheme: 'light' | 'dark';
  /** Whether system prefers dark mode */
  systemPrefersDark: boolean;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores auto) */
  toggleTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(key: string): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(key);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored;
  }
  return null;
}

function resolveTheme(theme: Theme, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'auto') {
    return systemDark ? 'dark' : 'light';
  }
  return theme;
}

function applyThemeToDocument(resolvedTheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  
  // Set data attribute for CSS
  document.documentElement.dataset.theme = resolvedTheme;
  
  // Set Gravity UI theme
  document.documentElement.classList.remove('g-root_theme_light', 'g-root_theme_dark');
  document.documentElement.classList.add(`g-root_theme_${resolvedTheme}`);
  
  // Set meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      resolvedTheme === 'dark' ? '#1c1c1e' : '#ffffff'
    );
  }
}

export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const { 
    initialTheme = 'auto', 
    storageKey = THEME_STORAGE_KEY 
  } = options;

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemTheme() === 'dark');
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme(storageKey);
    return stored ?? initialTheme;
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document when resolved theme changes
  const resolvedTheme = resolveTheme(theme, systemPrefersDark);
  
  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  // Set theme with persistence
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      localStorage.setItem(storageKey, newTheme);
    },
    [storageKey]
  );

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    systemPrefersDark,
    setTheme,
    toggleTheme,
  };
}
