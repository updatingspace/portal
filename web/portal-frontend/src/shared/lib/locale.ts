export type Locale = 'en' | 'ru';

const STORAGE_KEY = 'portal_locale_v1';

export const getLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'ru' || raw === 'en' ? raw : 'en';
};

export const setLocale = (locale: Locale): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
};
