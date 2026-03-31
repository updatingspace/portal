import { describe, expect, it } from 'vitest';

import { getBuildId, getVersionInfo } from './version';

describe('version utils', () => {
  it('returns build id fallback and includes environment in version info', () => {
    expect(typeof getBuildId()).toBe('string');

    const info = getVersionInfo();

    expect(info).toMatchObject({ buildId: getBuildId() });
    expect(typeof info.environment).toBe('string');
  });
});
