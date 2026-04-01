/**
 * Type definitions for personalization feature
 */

// Theme options
export type Theme = 'light' | 'dark' | 'auto';

// Supported languages
export type Language = 'en' | 'ru';

// Font size options
export type FontSize = 'small' | 'medium' | 'large';

// Profile visibility options
export type ProfileVisibility = 'public' | 'members' | 'private';

// Email digest frequency
export type EmailDigest = 'instant' | 'hourly' | 'daily' | 'weekly';

// Notification channels
export type NotificationChannel = 'email' | 'in_app' | 'push';

/**
 * Appearance preferences
 */
export interface AppearanceSettings {
  theme: Theme;
  accent_color: string;
  font_size: FontSize;
  high_contrast: boolean;
  reduce_motion: boolean;
}

/**
 * Localization preferences
 */
export interface LocalizationSettings {
  language: Language;
  timezone: string;
}

/**
 * Notification channel configuration
 */
export interface NotificationChannelConfig {
  enabled: boolean;
  channels: NotificationChannel[];
}

/**
 * Email notification settings
 */
export interface EmailNotificationSettings {
  enabled: boolean;
  digest: EmailDigest;
}

/**
 * In-app notification settings
 */
export interface InAppNotificationSettings {
  enabled: boolean;
}

/**
 * Push notification settings
 */
export interface PushNotificationSettings {
  enabled: boolean;
}

/**
 * Quiet hours configuration
 */
export interface QuietHoursSettings {
  enabled: boolean;
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

/**
 * Notification type configuration
 */
export interface NotificationTypeConfig {
  [key: string]: NotificationChannelConfig;
}

/**
 * Full notification settings
 */
export interface NotificationSettings {
  email: EmailNotificationSettings;
  in_app: InAppNotificationSettings;
  push: PushNotificationSettings;
  types: {
    polls?: NotificationTypeConfig;
    events?: NotificationTypeConfig;
    community?: NotificationTypeConfig;
    system?: NotificationTypeConfig;
  };
  quiet_hours: QuietHoursSettings;
}

/**
 * Privacy preferences
 */
export interface PrivacySettings {
  profile_visibility: ProfileVisibility;
  show_online_status: boolean;
  show_vote_history: boolean;
  share_activity: boolean;
  allow_mentions: boolean;
  analytics_enabled: boolean;
  recommendations_enabled: boolean;
}

/**
 * Full user preferences
 */
export interface UserPreferences {
  id: string;
  user_id: string;
  tenant_id: string;
  appearance: AppearanceSettings;
  localization: LocalizationSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  created_at: string;
  updated_at: string;
}

/**
 * Partial preferences update payload
 */
export interface PreferencesUpdatePayload {
  appearance?: Partial<AppearanceSettings>;
  localization?: Partial<LocalizationSettings>;
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
}

/**
 * Default preferences (for reset/reference)
 */
export interface DefaultPreferences {
  appearance: AppearanceSettings;
  localization: LocalizationSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

/**
 * Timezone option for selector
 */
export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
  region: string;
}

/**
 * Language option for selector
 */
export interface LanguageOption {
  value: Language;
  label: string;
  nativeLabel: string;
}

/**
 * Theme option for selector
 */
export interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: string;
}

/**
 * Font size option for selector
 */
export interface FontSizeOption {
  value: FontSize;
  label: string;
  preview: string;
}
