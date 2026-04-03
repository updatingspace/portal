import { createContext, useContext } from 'react';

import type { Locale } from '@/shared/lib/locale';

export type I18nContextValue = {
  locale: Locale;
  changeLocale: (next: Locale) => void;
};

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
