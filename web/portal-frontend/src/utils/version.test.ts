import { describe, it, expect } from 'vitest';
import { getBuildId, getVersionInfo } from './version';

describe('version utils', () => {
  describe('getBuildId', () => {
    it('should return a string value', () => {
      const buildId = getBuildId();
      expect(typeof buildId).toBe('string');
    });

    it('should return a non-empty build id', () => {
      const buildId = getBuildId();
      expect(buildId.length).toBeGreaterThan(0);
    });

    it('should return build id in supported format', () => {
      // In test environment, VITE_BUILD_ID is not set by default
      const buildId = getBuildId();
      // Build ID should be either 'dev' or match the pattern YYYY.MM.DD-RUN-SHA
      const isDevOrValidPattern = buildId === 'dev' || /^\d{4}\.\d{2}\.\d{2}-\d+-[a-f0-9]{7}$/.test(buildId);
      expect(isDevOrValidPattern).toBe(true);
    });
  });

  describe('getVersionInfo', () => {
    it('should return version info with buildId property', () => {
      const versionInfo = getVersionInfo();
      expect(versionInfo).toHaveProperty('buildId');
    });

    it('should return version info with environment property', () => {
      const versionInfo = getVersionInfo();
      expect(versionInfo).toHaveProperty('environment');
    });

    it('should return string buildId in version info', () => {
      const versionInfo = getVersionInfo();
      expect(typeof versionInfo.buildId).toBe('string');
    });

    it('should return string environment in version info', () => {
      const versionInfo = getVersionInfo();
      expect(typeof versionInfo.environment).toBe('string');
    });

    it('should include environment from MODE', () => {
      const versionInfo = getVersionInfo();
      // MODE should be set by Vitest (usually 'test')
      expect(versionInfo.environment).toBeTruthy();
    });
  });
});
