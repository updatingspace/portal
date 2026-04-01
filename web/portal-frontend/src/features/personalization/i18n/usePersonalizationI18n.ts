import { useMemo } from 'react';

import { useI18n } from '@/app/providers/I18nProvider';
import type { Locale } from '@/shared/lib/locale';

import { personalizationMessages } from './messages';

type Messages = typeof personalizationMessages.en;

const getByPath = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

export const usePersonalizationI18n = () => {
  const { locale } = useI18n();

  const messages = useMemo(() => personalizationMessages[locale as Locale] as Messages, [locale]);
  const fallback = personalizationMessages.en;

  const t = (path: string): string => {
    const localized = getByPath(messages, path);
    if (typeof localized === 'string') {
      return localized;
    }

    const fallbackValue = getByPath(fallback, path);
    if (typeof fallbackValue === 'string') {
      return fallbackValue;
    }

    return path;
  };

  return { t, locale };
};
