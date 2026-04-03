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
  const labelCases: Array<[string, () => string, string]> = [
    ['draft status', () => POLL_STATUS_META.draft.label, 'Черновик'],
    ['active status', () => POLL_STATUS_META.active.label, 'Активно'],
    ['closed status', () => POLL_STATUS_META.closed.label, 'Завершено'],
    ['public visibility', () => VISIBILITY_META.public.label, 'Публичный доступ'],
    ['private visibility', () => VISIBILITY_META.private.label, 'Приватный'],
    ['always results visibility', () => RESULTS_VISIBILITY_META.always.label, 'Результаты открыты'],
    [
      'after_closed results visibility',
      () => RESULTS_VISIBILITY_META.after_closed.label,
      'Результаты после закрытия',
    ],
    ['game nomination kind', () => NOMINATION_KIND_LABELS.game, 'Игра'],
  ];

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(labelCases)('provides russian label for %s', (_name, getLabel, expected) => {
    expect(getLabel()).toBe(expected);
  });

  it('formats date when input is valid', () => {
    const value = '2024-03-12T10:30:00Z';
    const dateResult = formatDate(value, 'en');

    expect(dateResult).toBeTypeOf('string');
  });

  it('formats date-time when input is valid', () => {
    const value = '2024-03-12T10:30:00Z';
    const dateTimeResult = formatDateTime(value, 'en');

    expect(dateTimeResult).toBeTypeOf('string');
  });

  it('returns null for invalid date values', () => {
    expect(formatDate('invalid-date')).toBeNull();
    expect(formatDateTime('invalid-date')).toBeNull();
  });

  it.each([
    ['upcoming poll', '2024-01-02T10:00:00Z', null, 'Старт'],
    ['active poll', '2023-12-31T10:00:00Z', '2024-01-02T10:00:00Z', 'До'],
    ['finished poll', '2023-12-30T10:00:00Z', '2023-12-31T10:00:00Z', 'Завершено'],
  ])('derives schedule label for %s', (_name, startsAt, endsAt, expectedLabel) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

    const scheduleMeta = getScheduleMeta(startsAt, endsAt);
    expect(scheduleMeta?.label).toBe(expectedLabel);
  });
});
