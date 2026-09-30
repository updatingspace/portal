import { dateTime } from '@gravity-ui/date-utils';

/** Interpret a datetime-local value in the displayed zone, independent of the device. */
export function parseLocalDateTime(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return dateTime({ input: NaN });
  const [, year, month, date, hour, minute] = match.map(Number);
  const result = dateTime({
    input: {
      year,
      month: month - 1,
      date,
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    timeZone,
  });
  const normalized = dateTime({ input: result.valueOf(), timeZone });
  // Reject invalid dates and local times skipped by a daylight-saving transition.
  return normalized.format('YYYY-MM-DDTHH:mm') === value
    ? normalized
    : dateTime({ input: NaN });
}
