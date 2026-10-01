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

export const getClientTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

export const normalizeTimezone = (value: string | null | undefined): string => {
  if (!value?.trim() || value === 'system') return getClientTimezone();
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.trim() });
    return value.trim();
  } catch {
    return getClientTimezone();
  }
};

// UTC was the previous implicit preference; Etc/UTC is an explicit manual choice.
export const resolvePreferenceTimezone = (value: string | null | undefined) =>
  normalizeTimezone(value === 'UTC' ? 'system' : value);

export const getLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    return normalizeLocale(window.localStorage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
};

export const setLocale = (locale: Locale): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* In-memory locale remains usable. */
  }
};

export const getTimezone = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_TIMEZONE;
  }
  try {
    return resolvePreferenceTimezone(
      window.localStorage?.getItem(TIMEZONE_STORAGE_KEY),
    );
  } catch {
    return getClientTimezone();
  }
};

export const setTimezone = (timezone: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(
      TIMEZONE_STORAGE_KEY,
      normalizeTimezone(timezone),
    );
  } catch {
    /* Optional storage. */
  }
};
