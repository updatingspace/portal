/**
 * PreferencesProvider - Global context for user preferences
 * Provides preferences access throughout the app
 */
import React, { useEffect, useMemo, type ReactNode } from 'react';

import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import type { UserPreferences, Theme, Language, FontSize, ProfileVisibility } from '../types';
import { PreferencesContext } from './preferencesStoreContext';

export interface PreferencesContextValue {
  // Data
  preferences: UserPreferences | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Theme management
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  systemPrefersDark: boolean;
  setTheme: (theme: Theme) => void;
  
  // Quick accessors for common settings
  language: Language;
  fontSize: FontSize;
  profileVisibility: ProfileVisibility;
  highContrast: boolean;
  reduceMotion: boolean;
  
  // Update functions
  updateAppearance: (appearance: Partial<UserPreferences['appearance']>) => Promise<void>;
  updateLocalization: (localization: Partial<UserPreferences['localization']>) => Promise<void>;
  updateNotifications: (notifications: Partial<UserPreferences['notifications']>) => Promise<void>;
  updatePrivacy: (privacy: Partial<UserPreferences['privacy']>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  
  // State
  isSaving: boolean;
  isResetting: boolean;
}

interface PreferencesProviderProps {
  children: ReactNode;
  /**
   * Enable auto-loading of preferences on mount
   * @default true
   */
  autoLoad?: boolean;
}

export function PreferencesProvider({ 
  children, 
  autoLoad = true 
}: PreferencesProviderProps) {
  const {
    preferences,
    updateAppearance,
    updateLocalization, 
    updateNotifications,
    updatePrivacy,
    resetToDefaults,
    isLoading,
    isError,
    error,
    isSaving,
    isResetting,
  } = usePreferences({ enabled: autoLoad });

  // Theme management
  const {
    theme,
    resolvedTheme,
    systemPrefersDark,
    setTheme: setThemeInternal,
  } = useTheme({
    initialTheme: preferences?.appearance?.theme || 'auto',
  });

  // Sync theme changes with preferences
  useEffect(() => {
    if (preferences && preferences.appearance.theme !== theme) {
      updateAppearance({ theme });
    }
  }, [theme, preferences, updateAppearance]);

  // Apply appearance settings to DOM
  useEffect(() => {
    if (!preferences) return;

    const { appearance } = preferences;
    const documentElement = document.documentElement;

    // Font size
    documentElement.style.setProperty('--user-font-size', 
      appearance.font_size === 'small' ? '14px' :
      appearance.font_size === 'large' ? '16px' : '15px'
    );

    // Accent color
    documentElement.style.setProperty('--user-accent-color', appearance.accent_color);

    // Accessibility
    documentElement.dataset.highContrast = appearance.high_contrast.toString();
    documentElement.dataset.reduceMotion = appearance.reduce_motion.toString();

    // Body class for reduce motion preference
    if (appearance.reduce_motion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }, [preferences]);

  // Wrapper for setTheme that updates preferences
  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeInternal(newTheme);
    updateAppearance({ theme: newTheme });
  }, [setThemeInternal, updateAppearance]);

  const contextValue = useMemo((): PreferencesContextValue => {
    const defaults = {
      language: 'en' as Language,
      fontSize: 'medium' as FontSize,
      profileVisibility: 'members' as ProfileVisibility,
      highContrast: false,
      reduceMotion: false,
    };

    return {
      // Data
      preferences,
      isLoading,
      isError,
      error,

      // Theme
      theme,
      resolvedTheme,
      systemPrefersDark,
      setTheme,

      // Quick accessors
      language: preferences?.localization?.language || defaults.language,
      fontSize: preferences?.appearance?.font_size || defaults.fontSize,
      profileVisibility: preferences?.privacy?.profile_visibility || defaults.profileVisibility,
      highContrast: preferences?.appearance?.high_contrast || defaults.highContrast,
      reduceMotion: preferences?.appearance?.reduce_motion || defaults.reduceMotion,

      // Functions
      updateAppearance,
      updateLocalization,
      updateNotifications,
      updatePrivacy,
      resetToDefaults,

      // State
      isSaving,
      isResetting,
    };
  }, [
    preferences,
    isLoading,
    isError,
    error,
    theme,
    resolvedTheme,
    systemPrefersDark,
    setTheme,
    updateAppearance,
    updateLocalization,
    updateNotifications,
    updatePrivacy,
    resetToDefaults,
    isSaving,
    isResetting,
  ]);

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
}
