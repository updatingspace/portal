/**
 * Personalization feature
 *
 * Handles user preferences including:
 * - Appearance (theme, accent color, font size)
 * - Localization (language, timezone)
 * - Notifications (email, in-app, push)
 * - Privacy (profile visibility, activity sharing)
 */

// Types
export * from './types';

// API
export * from './api/personalizationApi';

// Hooks
export * from './hooks';

// Components - explicit exports to avoid naming conflicts with types
export {
  SettingsSection,
  ThemeSelector,
  LanguageSelector,
  TimezoneSelector,
  FontSizeSelector,
  ColorPicker,
  NotificationToggle,
  PrivacyToggle,
  AppearanceSettings as AppearanceSettingsPanel,
  NotificationsSettings as NotificationsSettingsPanel,
  PrivacySettings as PrivacySettingsPanel,
} from './components';

export type {
  SettingsSectionProps,
  ThemeSelectorProps,
  LanguageSelectorProps,
  TimezoneSelectorProps,
  FontSizeSelectorProps,
  ColorPickerProps,
  NotificationToggleProps,
  PrivacyToggleProps,
  AppearanceSettingsProps,
  NotificationsSettingsProps,
  PrivacySettingsProps,
} from './components';
