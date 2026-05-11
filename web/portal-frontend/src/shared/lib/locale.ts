export type Locale = 'en' | 'ru';

export const LOCALE_STORAGE_KEY = 'portal_locale_v1';
export const TIMEZONE_STORAGE_KEY = 'portal_timezone_v1';
export const DEFAULT_LOCALE: Locale = 'en';
export const DEFAULT_TIMEZONE = 'UTC';

export const normalizeLocale = (value: string | null | undefined): Locale => {
  if (value === 'ru' || value?.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

export const normalizeTimezone = (value: string | null | undefined): string => {
  if (!value || !value.trim()) {
    return DEFAULT_TIMEZONE;
  }
  return value.trim();
};

export const getLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
};

export const setLocale = (locale: Locale): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

export const getTimezone = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_TIMEZONE;
  }
  return normalizeTimezone(window.localStorage.getItem(TIMEZONE_STORAGE_KEY));
};

export const setTimezone = (timezone: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TIMEZONE_STORAGE_KEY, normalizeTimezone(timezone));
};
