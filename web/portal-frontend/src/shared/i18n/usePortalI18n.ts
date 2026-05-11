import { useMemo } from 'react';

import { useI18n } from '@/app/providers/i18nContext';
import type { Locale } from '@/shared/lib/locale';

import { portalMessages } from './messages';

type Messages = typeof portalMessages.en;

const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

export const usePortalI18n = () => {
  const { locale } = useI18n();

  const messages = useMemo(() => portalMessages[locale as Locale] as Messages, [locale]);
  const fallback = portalMessages.en;

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

  return { locale, t };
};
