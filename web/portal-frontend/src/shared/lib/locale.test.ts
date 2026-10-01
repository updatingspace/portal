import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTimezone,
  normalizeTimezone,
  resolvePreferenceTimezone,
} from './locale';
describe('client timezone', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it('defaults to the browser zone when no preference exists', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Europe/Tallinn',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(getTimezone()).toBe('Europe/Tallinn');
  });
  it('resolves system and invalid values to the browser zone', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'America/Los_Angeles',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(normalizeTimezone('system')).toBe('America/Los_Angeles');
    expect(normalizeTimezone('bad/zone')).toBe('America/Los_Angeles');
  });
  it('keeps an explicitly selected zone including UTC', () => {
    localStorage.setItem('portal_timezone_v1', 'Etc/UTC');
    expect(getTimezone()).toBe('Etc/UTC');
    expect(normalizeTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });
});

it('migrates the old UTC default while preserving explicit UTC', () => {
  expect(resolvePreferenceTimezone('UTC')).toBe(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  expect(resolvePreferenceTimezone('Etc/UTC')).toBe('Etc/UTC');
});
