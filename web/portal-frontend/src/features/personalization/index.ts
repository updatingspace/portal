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
export * from './hooks/usePreferences';

// Components
export * from './components/settings/ThemeSelector';
export * from './components/settings/LanguageSelector';
export * from './components/settings/TimezoneSelector';
export * from './components/settings/FontSizeSelector';
export * from './components/settings/ColorPicker';
export * from './components/settings/NotificationToggle';
export * from './components/settings/PrivacyToggle';
export * from './components/settings/SettingsSection';
