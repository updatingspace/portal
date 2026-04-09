import { useMemo } from 'react';

import { useI18n } from '@/app/providers/i18nContext';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  formatTime,
  resolveIntlLocale,
} from '@/shared/lib/formatters';

export const useFormatters = () => {
  const { locale, timezone } = useI18n();

  return useMemo(
    () => ({
      locale,
      timezone,
      intlLocale: resolveIntlLocale(locale),
      formatDate: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, { locale, timezone }, options),
      formatTime: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
        formatTime(value, { locale, timezone }, options),
      formatDateTime: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
        formatDateTime(value, { locale, timezone }, options),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, { locale, timezone }, options),
      formatRelativeTime: (value: string | number | Date | null | undefined) =>
        formatRelativeTime(value, { locale, timezone }),
    }),
    [locale, timezone],
  );
};
