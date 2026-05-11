import type { Locale } from './locale';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, normalizeLocale, normalizeTimezone } from './locale';

export type FormattingContext = {
  locale?: Locale | string | null;
  timezone?: string | null;
};

const LOCALE_MAP: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
};

export const resolveIntlLocale = (locale?: Locale | string | null): string =>
  LOCALE_MAP[normalizeLocale(locale ?? null)];

export const resolveTimezone = (timezone?: string | null): string =>
  normalizeTimezone(timezone ?? DEFAULT_TIMEZONE);

const getRuntimeLocale = (): Locale => {
  if (typeof document !== 'undefined') {
    const rawLocale = document.documentElement.dataset.locale;
    if (rawLocale) {
      return normalizeLocale(rawLocale);
    }
  }
  if (typeof window !== 'undefined') {
    return normalizeLocale(window.localStorage.getItem('portal_locale_v1'));
  }
  return DEFAULT_LOCALE;
};

const getRuntimeTimezone = (): string => {
  if (typeof document !== 'undefined') {
    const rawTimezone = document.documentElement.dataset.timezone;
    if (rawTimezone) {
      return normalizeTimezone(rawTimezone);
    }
  }
  if (typeof window !== 'undefined') {
    return normalizeTimezone(window.localStorage.getItem('portal_timezone_v1'));
  }
  return DEFAULT_TIMEZONE;
};

const resolveContextLocale = (ctx: FormattingContext): string =>
  resolveIntlLocale(ctx.locale ?? getRuntimeLocale());

const resolveContextTimezone = (ctx: FormattingContext): string =>
  resolveTimezone(ctx.timezone ?? getRuntimeTimezone());

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateTimeFormat = (
  ctx: FormattingContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(resolveContextLocale(ctx), {
    timeZone: resolveContextTimezone(ctx),
    ...options,
  });

export const formatDate = (
  value: string | number | Date | null | undefined,
  ctx: FormattingContext = {},
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  if (!date) return '—';
  return buildDateTimeFormat(ctx, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date);
};

export const formatTime = (
  value: string | number | Date | null | undefined,
  ctx: FormattingContext = {},
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  if (!date) return '—';
  return buildDateTimeFormat(ctx, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
};

export const formatDateTime = (
  value: string | number | Date | null | undefined,
  ctx: FormattingContext = {},
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  if (!date) return '—';
  return buildDateTimeFormat(ctx, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
};

export const formatNumber = (
  value: number,
  ctx: FormattingContext = {},
  options: Intl.NumberFormatOptions = {},
): string =>
  new Intl.NumberFormat(resolveContextLocale(ctx), options).format(value);

export const formatRelativeTime = (
  value: string | number | Date | null | undefined,
  ctx: FormattingContext = {},
): string => {
  const date = toDate(value);
  if (!date) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(resolveContextLocale(ctx), {
    numeric: 'auto',
  });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, 'day');
};
