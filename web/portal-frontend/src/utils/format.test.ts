import { describe, expect, it } from 'vitest';

import { formatReleaseYear } from './format';

describe('formatReleaseYear', () => {
  it('formats valid year and fallback dash for empty values', () => {
    expect(formatReleaseYear(2024)).toBe('2024');
    expect(formatReleaseYear(null)).toBe('—');
    expect(formatReleaseYear(undefined)).toBe('—');
    expect(formatReleaseYear(0)).toBe('—');
  });
});
