import { resolvePreferenceTimezone } from '../../../shared/lib/locale';
import { accessibleAccent } from '../../../shared/lib/contrast';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../../app/providers/i18nContext';
import { useThemeMode } from '../../../app/providers/themeModeContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { UserPreferences } from '../types';
import {
  readCachedPreferences,
  PERSONALIZATION_PREFERENCES_UPDATED_EVENT,
  usePreferences,
} from '../hooks/usePreferences';

const fontSizeToCssValue = (
  fontSize: UserPreferences['appearance']['font_size'],
): string => {
  if (fontSize === 'small') {
    return '14px';
  }
  if (fontSize === 'large') {
    return '16px';
  }
  return '15px';
};

const fontSizeToScale = (
  fontSize: UserPreferences['appearance']['font_size'],
): string => {
  if (fontSize === 'small') {
    return '0.9375';
  }
  if (fontSize === 'large') {
    return '1.0625';
  }
  return '1';
};

const getPreferenceTimestamp = (
  preferences?: UserPreferences | null,
): number => {
  if (!preferences) {
    return 0;
  }

  const timestamp = Date.parse(preferences.updated_at);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const applyAppearanceSettings = (
  appearance?: UserPreferences['appearance'],
) => {
  if (typeof document === 'undefined') {
    return;
  }

  const documentElement = document.documentElement;

  if (!appearance) {
    documentElement.style.removeProperty('--user-font-size');
    documentElement.style.removeProperty('--portal-font-scale');
    documentElement.style.removeProperty('--user-accent-color');
    documentElement.style.removeProperty('--portal-focus-ring-color');
    documentElement.dataset.highContrast = 'false';
    documentElement.dataset.reduceMotion = 'false';
    document.body.classList.remove('reduce-motion');
    return;
  }

  documentElement.style.setProperty(
    '--user-font-size',
    fontSizeToCssValue(appearance.font_size),
  );
  documentElement.style.setProperty(
    '--portal-font-scale',
    fontSizeToScale(appearance.font_size),
  );
  documentElement.style.setProperty(
    '--user-accent-color',
    appearance.accent_color,
  );
  documentElement.style.setProperty(
    '--portal-focus-ring-color',
    `${appearance.accent_color}33`,
  );
  documentElement.dataset.highContrast = appearance.high_contrast.toString();
  documentElement.dataset.reduceMotion = appearance.reduce_motion.toString();

  if (appearance.reduce_motion) {
    document.body.classList.add('reduce-motion');
  } else {
    document.body.classList.remove('reduce-motion');
  }
};

export function PersonalizationRuntime() {
  const { user } = useAuth();
  const { locale, timezone, changeLocale, changeTimezone } = useI18n();
  const { mode, resolvedMode, setMode } = useThemeMode();
  const currentModeRef = useRef<'light' | 'dark' | 'auto'>(mode);
  const { preferences } = usePreferences({
    enabled: Boolean(user),
    userId: user?.id,
    tenantId: user?.tenant?.id,
  });
  const [cachedPreferences, setCachedPreferences] = useState(() =>
    readCachedPreferences(user?.id, user?.tenant?.id),
  );
  const effectivePreferences = useMemo(() => {
    const cachedSnapshot =
      cachedPreferences ??
      (user ? readCachedPreferences(user?.id, user?.tenant?.id) : undefined);
    if (!preferences) {
      return cachedSnapshot;
    }
    if (!cachedSnapshot) {
      return preferences;
    }

    return getPreferenceTimestamp(cachedSnapshot) >
      getPreferenceTimestamp(preferences)
      ? cachedSnapshot
      : preferences;
  }, [cachedPreferences, preferences, user]);

  useEffect(() => {
    applyAppearanceSettings(effectivePreferences?.appearance);
  }, [effectivePreferences]);

  useEffect(() => {
    currentModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const preferredLanguage =
      effectivePreferences?.localization.language ??
      (user.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en');
    const preferredTimezone = resolvePreferenceTimezone(
      effectivePreferences?.localization.timezone,
    );

    if (preferredLanguage !== locale) {
      changeLocale(preferredLanguage);
    }
    if (preferredTimezone !== timezone) {
      changeTimezone(preferredTimezone);
    }
  }, [
    changeLocale,
    changeTimezone,
    effectivePreferences,
    locale,
    timezone,
    user,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== 'object') {
        return;
      }
      const next = detail as UserPreferences;
      if (next.user_id === user?.id && next.tenant_id === user?.tenant?.id)
        setCachedPreferences(next);
    };

    window.addEventListener(
      PERSONALIZATION_PREFERENCES_UPDATED_EVENT,
      handlePreferencesUpdated,
    );
    return () => {
      window.removeEventListener(
        PERSONALIZATION_PREFERENCES_UPDATED_EVENT,
        handlePreferencesUpdated,
      );
    };
  }, [user?.id, user?.tenant?.id]);

  useEffect(() => {
    const themeSource =
      effectivePreferences?.appearance.theme_source ?? 'portal';
    const preferredTheme =
      themeSource === 'id' && user?.idTheme
        ? user.idTheme
        : effectivePreferences?.appearance.theme;
    if (!preferredTheme || preferredTheme === currentModeRef.current) {
      return;
    }

    currentModeRef.current = preferredTheme;
    setMode(preferredTheme);
  }, [effectivePreferences, setMode, user?.idTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.themeMode =
      effectivePreferences?.appearance.theme_source === 'id' && user?.idTheme
        ? user.idTheme
        : (effectivePreferences?.appearance.theme ?? mode);
  }, [effectivePreferences, mode, user?.idTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const color = effectivePreferences?.appearance.accent_color;
    if (color) {
      const accent = accessibleAccent(color, resolvedMode);
      root.style.setProperty('--portal-custom-brand', accent.brand);
      root.style.setProperty('--portal-custom-brand-text', accent.text);
      root.style.setProperty('--portal-custom-link', accent.link);
    }
    return () => {
      for (const key of [
        '--portal-custom-brand',
        '--portal-custom-brand-text',
        '--portal-custom-link',
      ])
        root.style.removeProperty(key);
    };
  }, [effectivePreferences?.appearance.accent_color, resolvedMode]);

  return null;
}
