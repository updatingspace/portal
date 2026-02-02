import type { NominationKind, PollScopeType, PollStatus, PollVisibility, ResultsVisibility } from '../types';

type LabelTheme = 'normal' | 'info' | 'success' | 'warning' | 'danger' | 'utility';

export const POLL_STATUS_META: Record<
  PollStatus,
  { label: string; theme: LabelTheme; description: string }
> = {
  draft: {
    label: 'Черновик',
    theme: 'warning',
    description: 'Опрос ещё настраивается и не принимает голоса.',
  },
  active: {
    label: 'Активно',
    theme: 'success',
    description: 'Голосование идёт прямо сейчас.',
  },
  closed: {
    label: 'Завершено',
    theme: 'utility',
    description: 'Голосование закрыто, голоса не принимаются.',
  },
};

export const VISIBILITY_META: Record<
  PollVisibility,
  { label: string; theme: LabelTheme; description: string }
> = {
  public: {
    label: 'Публичный доступ',
    theme: 'info',
    description: 'Опрос виден всем участникам тенанта.',
  },
  community: {
    label: 'Сообщество',
    theme: 'success',
    description: 'Опрос доступен участникам выбранного сообщества.',
  },
  team: {
    label: 'Команда',
    theme: 'warning',
    description: 'Опрос доступен конкретной команде.',
  },
  private: {
    label: 'Приватный',
    theme: 'danger',
    description: 'Опрос доступен только приглашённым участникам.',
  },
};

export const RESULTS_VISIBILITY_META: Record<
  ResultsVisibility,
  { label: string; theme: LabelTheme; description: string }
> = {
  always: {
    label: 'Результаты открыты',
    theme: 'success',
    description: 'Результаты доступны сразу после голосования.',
  },
  after_closed: {
    label: 'Результаты после закрытия',
    theme: 'warning',
    description: 'Результаты откроются после завершения опроса.',
  },
  admins_only: {
    label: 'Только администраторам',
    theme: 'utility',
    description: 'Результаты доступны только владельцам и администраторам.',
  },
};

export const SCOPE_LABELS: Record<PollScopeType, string> = {
  TENANT: 'Тенант',
  COMMUNITY: 'Сообщество',
  TEAM: 'Команда',
  EVENT: 'Событие',
  POST: 'Пост',
};

export const NOMINATION_KIND_LABELS: Record<NominationKind, string> = {
  game: 'Игра',
  review: 'Отзыв',
  person: 'Персона',
  custom: 'Свой вариант',
};

const normalizeLocale = (locale?: string | null) => {
  if (!locale) return 'ru-RU';
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'en') return 'en-US';
  return locale;
};

const parseIsoDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value?: string | Date | null, locale?: string | null) => {
  const date = parseIsoDate(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat(normalizeLocale(locale), { dateStyle: 'medium' });
  return formatter.format(date);
};

export const formatDateTime = (value?: string | Date | null, locale?: string | null) => {
  const date = parseIsoDate(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat(normalizeLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return formatter.format(date);
};

export const getScheduleMeta = (startsAt?: string | null, endsAt?: string | null) => {
  const now = new Date();
  const starts = parseIsoDate(startsAt);
  const ends = parseIsoDate(endsAt);

  if (starts && starts.getTime() > now.getTime()) {
    return { label: 'Старт', at: starts };
  }
  if (ends) {
    return { label: ends.getTime() < now.getTime() ? 'Завершено' : 'До', at: ends };
  }
  if (starts) {
    return { label: 'Старт', at: starts };
  }
  return null;
};
