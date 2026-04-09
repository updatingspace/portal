/**
 * Zod schemas for user preferences validation
 */
import { z } from 'zod';

// Base schemas for individual types
export const themeSchema = z.enum(['light', 'dark', 'auto']);
export const themeSourceSchema = z.enum(['portal', 'id']);
export const languageSchema = z.enum(['en', 'ru']);
export const fontSizeSchema = z.enum(['small', 'medium', 'large']);
export const profileVisibilitySchema = z.enum(['public', 'members', 'private']);
export const emailDigestSchema = z.enum(['instant', 'hourly', 'daily', 'weekly']);
export const notificationChannelSchema = z.enum(['email', 'in_app', 'push']);

// Color validation (hex format)
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format');

// Timezone validation (IANA timezone names)
export const timezoneSchema = z.string().min(1, 'Timezone is required').refine(
  (timezone) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },
  'Invalid timezone'
);

// Time format validation (HH:MM)
export const timeFormatSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)');

// Appearance settings schema
export const appearanceSettingsSchema = z.object({
  theme: themeSchema.optional(),
  theme_source: themeSourceSchema.optional(),
  accent_color: hexColorSchema.optional(),
  font_size: fontSizeSchema.optional(),
  high_contrast: z.boolean().optional(),
  reduce_motion: z.boolean().optional(),
});

// Localization settings schema  
export const localizationSettingsSchema = z.object({
  language: languageSchema.optional(),
  timezone: timezoneSchema.optional(),
});

// Notification channel config schema
export const notificationChannelConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(notificationChannelSchema).min(0),
});

// Email notification settings schema
export const emailNotificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  digest: emailDigestSchema.optional(),
});

// In-app notification settings schema
export const inAppNotificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
});

// Push notification settings schema
export const pushNotificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
});

// Quiet hours settings schema
export const quietHoursSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  start: timeFormatSchema.optional(),
  end: timeFormatSchema.optional(),
}).refine(
  (data) => {
    if (!data.enabled) return true;
    if (!data.start || !data.end) return false;
    
    // Validate that start and end times are different
    return data.start !== data.end;
  },
  {
    message: 'Start and end times must be different',
    path: ['end'],
  }
);

// Notification type config schema (for polls, events, etc.)
export const notificationTypeConfigSchema = z.record(z.string(), notificationChannelConfigSchema);

// Full notification settings schema
export const notificationSettingsSchema = z.object({
  email: emailNotificationSettingsSchema.optional(),
  in_app: inAppNotificationSettingsSchema.optional(),
  push: pushNotificationSettingsSchema.optional(),
  types: z.object({
    polls: notificationTypeConfigSchema.optional(),
    events: notificationTypeConfigSchema.optional(),
    community: notificationTypeConfigSchema.optional(),
    system: notificationTypeConfigSchema.optional(),
  }).optional(),
  quiet_hours: quietHoursSettingsSchema.optional(),
});

// Privacy settings schema
export const privacySettingsSchema = z.object({
  profile_visibility: profileVisibilitySchema.optional(),
  show_online_status: z.boolean().optional(),
  show_vote_history: z.boolean().optional(),
  share_activity: z.boolean().optional(),
  allow_mentions: z.boolean().optional(),
  analytics_enabled: z.boolean().optional(),
  recommendations_enabled: z.boolean().optional(),
});

// Main preferences update schema
export const preferencesUpdateSchema = z.object({
  appearance: appearanceSettingsSchema.optional(),
  localization: localizationSettingsSchema.optional(),
  notifications: notificationSettingsSchema.optional(),
  privacy: privacySettingsSchema.optional(),
});

// Full user preferences schema (for validation of complete data)
export const userPreferencesSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  appearance: z.object({
    theme: themeSchema,
    theme_source: themeSourceSchema,
    accent_color: hexColorSchema,
    font_size: fontSizeSchema,
    high_contrast: z.boolean(),
    reduce_motion: z.boolean(),
  }),
  localization: z.object({
    language: languageSchema,
    timezone: timezoneSchema,
  }),
  notifications: z.object({
    email: z.object({
      enabled: z.boolean(),
      digest: emailDigestSchema,
    }),
    in_app: z.object({
      enabled: z.boolean(),
    }),
    push: z.object({
      enabled: z.boolean(),
    }),
    types: z.object({
      polls: notificationTypeConfigSchema.optional(),
      events: notificationTypeConfigSchema.optional(),
      community: notificationTypeConfigSchema.optional(),
      system: notificationTypeConfigSchema.optional(),
    }),
    quiet_hours: z.object({
      enabled: z.boolean(),
      start: timeFormatSchema,
      end: timeFormatSchema,
    }),
  }),
  privacy: z.object({
    profile_visibility: profileVisibilitySchema,
    show_online_status: z.boolean(),
    show_vote_history: z.boolean(),
    share_activity: z.boolean(),
    allow_mentions: z.boolean(),
    analytics_enabled: z.boolean(),
    recommendations_enabled: z.boolean(),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Inferred TypeScript types from schemas
export type AppearanceSettingsInput = z.infer<typeof appearanceSettingsSchema>;
export type LocalizationSettingsInput = z.infer<typeof localizationSettingsSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type PrivacySettingsInput = z.infer<typeof privacySettingsSchema>;
export type PreferencesUpdateInput = z.infer<typeof preferencesUpdateSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
