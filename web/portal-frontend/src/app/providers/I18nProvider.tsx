import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getLocale, getTimezone, normalizeTimezone, setLocale, setTimezone } from '@/shared/lib/locale';
import type { Locale } from '@/shared/lib/locale';
import { I18nContext } from './i18nContext';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  const [timezone, setTimezoneState] = useState<string>(getTimezone());

  const changeLocale = useCallback(
    (next: Locale) => {
      if (next === locale) {
        return;
      }
      setLocale(next);
      setLocaleState(next);
    },
    [locale],
  );

  const changeTimezone = useCallback(
    (next: string) => {
      const normalized = normalizeTimezone(next);
      if (normalized === timezone) {
        return;
      }
      setTimezone(normalized);
      setTimezoneState(normalized);
    },
    [timezone],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.dataset.timezone = timezone;
  }, [timezone]);

  const value = useMemo(
    () => ({ locale, timezone, changeLocale, changeTimezone }),
    [locale, timezone, changeLocale, changeTimezone],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
