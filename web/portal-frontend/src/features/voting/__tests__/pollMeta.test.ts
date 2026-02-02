import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  NOMINATION_KIND_LABELS,
  POLL_STATUS_META,
  RESULTS_VISIBILITY_META,
  VISIBILITY_META,
  formatDate,
  formatDateTime,
  getScheduleMeta,
} from '../utils/pollMeta';

describe('pollMeta helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides russian labels for status and visibility', () => {
    expect(POLL_STATUS_META.draft.label).toBe('Черновик');
    expect(POLL_STATUS_META.active.label).toBe('Активно');
    expect(POLL_STATUS_META.closed.label).toBe('Завершено');

    expect(VISIBILITY_META.public.label).toBe('Публичный доступ');
    expect(VISIBILITY_META.private.label).toBe('Приватный');

    expect(RESULTS_VISIBILITY_META.always.label).toBe('Результаты открыты');
    expect(RESULTS_VISIBILITY_META.after_closed.label).toBe('Результаты после закрытия');
    expect(NOMINATION_KIND_LABELS.game).toBe('Игра');
  });

  it('formats dates when input is valid', () => {
    const value = '2024-03-12T10:30:00Z';
    const dateResult = formatDate(value, 'en');
    const dateTimeResult = formatDateTime(value, 'en');

    expect(dateResult).toBeTypeOf('string');
    expect(dateTimeResult).toBeTypeOf('string');
  });

  it('returns null for invalid date values', () => {
    expect(formatDate('invalid-date')).toBeNull();
    expect(formatDateTime('invalid-date')).toBeNull();
  });

  it('derives schedule meta based on current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

    const upcoming = getScheduleMeta('2024-01-02T10:00:00Z', null);
    expect(upcoming?.label).toBe('Старт');

    const active = getScheduleMeta('2023-12-31T10:00:00Z', '2024-01-02T10:00:00Z');
    expect(active?.label).toBe('До');

    const finished = getScheduleMeta('2023-12-30T10:00:00Z', '2023-12-31T10:00:00Z');
    expect(finished?.label).toBe('Завершено');
  });
});
