import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { getLocale, setLocale } from '../../shared/lib/locale';
import type { Locale } from '../../shared/lib/locale';

type I18nContextValue = {
  locale: Locale;
  changeLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

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

  const value = useMemo(() => ({ locale, changeLocale }), [locale, changeLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
