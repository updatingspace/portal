import { describe, expect, it } from 'vitest';

import { enforceHttpsForSameHost } from './url';

describe('enforceHttpsForSameHost', () => {
  const httpsLocation = { protocol: 'https:', hostname: 'portal.test', origin: 'https://portal.test' } as const;
  const httpLocation = { protocol: 'http:', hostname: 'portal.test', origin: 'http://portal.test' } as const;

  it('returns null/undefined and trimmed empty as is', () => {
    expect(enforceHttpsForSameHost(null, httpsLocation)).toBeNull();
    expect(enforceHttpsForSameHost(undefined, httpsLocation)).toBeUndefined();
    expect(enforceHttpsForSameHost('   ', httpsLocation)).toBe('');
  });

  it('upgrades same-host http URLs on https pages', () => {
    expect(enforceHttpsForSameHost('http://portal.test/a.png', httpsLocation)).toBe('https://portal.test/a.png');
  });

  it('does not rewrite different host or non-https pages', () => {
    expect(enforceHttpsForSameHost('http://cdn.test/a.png', httpsLocation)).toBe('http://cdn.test/a.png');
    expect(enforceHttpsForSameHost('http://portal.test/a.png', httpLocation)).toBe('http://portal.test/a.png');
  });

  it('keeps malformed urls unchanged', () => {
    expect(enforceHttpsForSameHost('::::', httpsLocation)).toBe('::::');
  });
});
