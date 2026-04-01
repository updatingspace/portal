/**
 * Personalization feature
 *
 * Handles user preferences including:
 * - Appearance (theme, accent color, font size)
 * - Localization (language, timezone)
 * - Notifications (email, in-app, push)
 * - Privacy (profile visibility, activity sharing)
 *
 * And content management:
 * - Homepage modals (CRUD, bulk actions, preview)
 * - Content widgets (banners, announcements)
 * - Analytics (views, clicks, CTR)
 */

// Types
export * from './types';

// Utils
export * from './utils';

// API
export * from './api/personalizationApi';
export * from './api/contentApi';

// Hooks
export * from './hooks';

// Contexts
export * from './contexts';

// Validation
export * from './validation';

// i18n
export * from './i18n';

// Components - explicit exports to avoid naming conflicts with types
export {
  // Settings components
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
  UserSettingsPanel,
  // Content management components
  ContentManagement,
  ModalTable,
  ModalEditor,
  ModalPreview,
  RichTextEditor,
  CalendarView,
  PreviewModeToggle,
  PreviewOverlay,
  usePreviewMode,
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
