import { describe, expect, it } from 'vitest';
import { parseLocalDateTime } from './dateTimeLocal';

describe('parseLocalDateTime', () => {
  it.each([
    ['2026-10-01T14:00', 'Europe/Moscow', '2026-10-01T11:00:00.000Z'],
    ['2026-10-01T14:00', 'UTC', '2026-10-01T14:00:00.000Z'],
    ['2026-07-01T14:00', 'America/New_York', '2026-07-01T18:00:00.000Z'],
    ['2026-01-01T14:00', 'America/New_York', '2026-01-01T19:00:00.000Z'],
    ['2026-10-01T01:00', 'Asia/Tokyo', '2026-09-30T16:00:00.000Z'],
  ])('interprets %s in %s', (value, zone, expected) => {
    expect(parseLocalDateTime(value, zone).toISOString()).toBe(expected);
  });
  it.each(['', '2026-02-30T10:00', '2026-03-08T02:30'])(
    'rejects invalid local time %s',
    (value) => {
      expect(parseLocalDateTime(value, 'America/New_York').isValid()).toBe(
        false,
      );
    },
  );
});
