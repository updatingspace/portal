import { vi } from 'vitest';

export const FIXED_TEST_TIME_ISO = '2025-01-02T12:00:00Z';

export function mockDateNow(isoDate: string = FIXED_TEST_TIME_ISO) {
  return vi.spyOn(Date, 'now').mockReturnValue(new Date(isoDate).getTime());
}

export function withMockedDate(testFn: () => Promise<void> | void, isoDate: string = FIXED_TEST_TIME_ISO) {
  return async () => {
    const nowSpy = mockDateNow(isoDate);
    try {
      await testFn();
    } finally {
      nowSpy.mockRestore();
    }
  };
}