/**
 * Tests for validation schemas
 */
import { describe, it, expect } from 'vitest';

import {
  appearanceSettingsSchema,
  localizationSettingsSchema,
  notificationSettingsSchema,
  privacySettingsSchema,
  preferencesUpdateSchema,
} from '../validation/schemas';

describe('Validation schemas', () => {
  describe('appearanceSettingsSchema', () => {
    it('validates correct appearance data', () => {
      const validData = {
        theme: 'light',
        accent_color: '#007AFF',
        font_size: 'medium',
        high_contrast: false,
        reduce_motion: true,
      };

      const result = appearanceSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid theme', () => {
      const invalidData = {
        theme: 'invalid',
      };

      const result = appearanceSettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects invalid hex color', () => {
      const invalidData = {
        accent_color: 'not-a-hex-color',
      };

      const result = appearanceSettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts valid hex colors', () => {
      const validColors = ['#000000', '#FFFFFF', '#007AFF', '#ff0000'];
      
      for (const color of validColors) {
        const result = appearanceSettingsSchema.safeParse({ accent_color: color });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('localizationSettingsSchema', () => {
    it('validates correct localization data', () => {
      const validData = {
        language: 'en',
        timezone: 'America/New_York',
      };

      const result = localizationSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid language', () => {
      const invalidData = {
        language: 'xx',
      };

      const result = localizationSettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('notificationSettingsSchema', () => {
    it('validates correct notification data', () => {
      const validData = {
        email: { enabled: true, digest: 'daily' },
        in_app: { enabled: false },
        push: { enabled: true },
        quiet_hours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
        },
      };

      const result = notificationSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects quiet hours with same start and end time', () => {
      const invalidData = {
        quiet_hours: {
          enabled: true,
          start: '22:00',
          end: '22:00',
        },
      };

      const result = notificationSettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts quiet hours when disabled', () => {
      const validData = {
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '22:00', // Same time is OK when disabled
        },
      };

      const result = notificationSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('privacySettingsSchema', () => {
    it('validates correct privacy data', () => {
      const validData = {
        profile_visibility: 'members',
        show_online_status: true,
        analytics_enabled: false,
      };

      const result = privacySettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid profile visibility', () => {
      const invalidData = {
        profile_visibility: 'invalid',
      };

      const result = privacySettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('preferencesUpdateSchema', () => {
    it('validates partial update with mixed settings', () => {
      const validData = {
        appearance: {
          theme: 'dark',
          font_size: 'large',
        },
        privacy: {
          profile_visibility: 'private',
        },
      };

      const result = preferencesUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('validates empty update', () => {
      const validData = {};

      const result = preferencesUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid nested data', () => {
      const invalidData = {
        appearance: {
          theme: 'invalid-theme',
        },
      };

      const result = preferencesUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});