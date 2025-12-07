import { describe, it, expect } from 'vitest';
import { getBuildId, getVersionInfo } from './version';

describe('version utils', () => {
  describe('getBuildId', () => {
    it('should return a string', () => {
      const buildId = getBuildId();
      expect(typeof buildId).toBe('string');
      expect(buildId.length).toBeGreaterThan(0);
    });

    it('should return a valid build ID', () => {
      // In test environment, VITE_BUILD_ID is not set by default
      const buildId = getBuildId();
      // It should return 'dev' when not set, or a valid BUILD_ID if set
      expect(buildId).toBeTruthy();
      // Build ID should be either 'dev' or match the pattern YYYY.MM.DD-RUN-SHA
      const isDevOrValidPattern = buildId === 'dev' || /^\d{4}\.\d{2}\.\d{2}-\d+-[a-f0-9]{7}$/.test(buildId);
      expect(isDevOrValidPattern).toBe(true);
    });
  });

  describe('getVersionInfo', () => {
    it('should return version info with required properties', () => {
      const versionInfo = getVersionInfo();
      expect(versionInfo).toHaveProperty('buildId');
      expect(versionInfo).toHaveProperty('environment');
      expect(typeof versionInfo.buildId).toBe('string');
      expect(typeof versionInfo.environment).toBe('string');
    });

    it('should include environment from MODE', () => {
      const versionInfo = getVersionInfo();
      // MODE should be set by Vitest (usually 'test')
      expect(versionInfo.environment).toBeTruthy();
    });
  });
});
