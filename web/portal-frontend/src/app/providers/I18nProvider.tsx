import React, { useCallback, useMemo, useState } from 'react';

import { getLocale, setLocale } from '@/shared/lib/locale';
import type { Locale } from '@/shared/lib/locale';
import { I18nContext } from './I18nContext';

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
