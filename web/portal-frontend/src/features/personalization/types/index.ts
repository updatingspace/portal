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

// =============================================================================
// Content Management Types
// =============================================================================

/**
 * Modal type options
 */
export type ModalType = 'info' | 'warning' | 'success' | 'promo';

/**
 * Widget type options
 */
export type WidgetType = 'banner' | 'announcement' | 'promotion' | 'notification';

/**
 * Widget placement options
 */
export type WidgetPlacement = 'top' | 'bottom' | 'sidebar' | 'inline';

/**
 * Analytics event types
 */
export type AnalyticsEventType = 'view' | 'click' | 'dismiss';

/**
 * Bulk action types
 */
export type BulkAction = 'activate' | 'deactivate' | 'delete' | 'restore';

/**
 * Modal translations
 */
export interface ModalTranslations {
  [language: string]: {
    title?: string;
    content?: string;
    button_text?: string;
  };
}

/**
 * Homepage modal (full)
 */
export interface HomePageModal {
  id: number;
  title: string;
  content: string;
  content_html: string;
  button_text: string;
  button_url: string;
  modal_type: ModalType;
  is_active: boolean;
  display_once: boolean;
  start_date: string | null;
  end_date: string | null;
  order: number;
  translations: ModalTranslations;
  version: number;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Homepage modal input (for create/update)
 */
export interface HomePageModalInput {
  title: string;
  content: string;
  content_html?: string;
  button_text?: string;
  button_url?: string;
  modal_type?: ModalType;
  is_active?: boolean;
  display_once?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  order?: number;
  translations?: ModalTranslations;
}

/**
 * Modal list filters
 */
export interface ModalListFilters {
  includeDeleted?: boolean;
  isActive?: boolean;
  modalType?: ModalType;
  search?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
}

/**
 * Bulk action payload
 */
export interface BulkActionPayload {
  modalIds: number[];
  action: BulkAction;
}

/**
 * Bulk action result
 */
export interface BulkActionResult {
  success: boolean;
  affected: number;
}

/**
 * Content widget content structure
 */
export interface WidgetContent {
  title?: string;
  body?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
  [key: string]: unknown;
}

/**
 * Content widget
 */
export interface ContentWidget {
  id: string;
  tenant_id: string;
  name: string;
  widget_type: WidgetType;
  placement: WidgetPlacement;
  content: WidgetContent;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  target_pages: string[];
  target_roles: string[];
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Content widget input
 */
export interface ContentWidgetInput {
  name: string;
  widget_type?: WidgetType;
  placement?: WidgetPlacement;
  content?: WidgetContent;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  priority?: number;
  target_pages?: string[];
  target_roles?: string[];
}

/**
 * Analytics event payload
 */
export interface AnalyticsEventPayload {
  modalId: number;
  eventType: AnalyticsEventType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Modal analytics summary
 */
export interface ModalAnalytics {
  modal_id: number;
  modal_title: string;
  total_views: number;
  total_clicks: number;
  total_dismissals: number;
  click_through_rate: number;
}

/**
 * Analytics report
 */
export interface AnalyticsReport {
  period_start: string;
  period_end: string;
  total_modals: number;
  total_views: number;
  total_clicks: number;
  total_dismissals: number;
  average_ctr: number;
  modals: ModalAnalytics[];
}

/**
 * Modal form state (for editor)
 */
export interface ModalFormState {
  title: string;
  content: string;
  contentHtml: string;
  buttonText: string;
  buttonUrl: string;
  modalType: ModalType;
  isActive: boolean;
  displayOnce: boolean;
  startDate: Date | null;
  endDate: Date | null;
  order: number;
  translations: ModalTranslations;
}

/**
 * Modal type option for selector
 */
export interface ModalTypeOption {
  value: ModalType;
  label: string;
  description: string;
  color: string;
}

/**
 * Table column definition
 */
export interface TableColumn<T> {
  id: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: number | string;
  render?: (item: T) => React.ReactNode;
}

/**
 * Sort state
 */
export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// =============================================================================
// Dashboard Customization Types
// =============================================================================

export interface DashboardLayout {
  id: string;
  user_id: string;
  tenant_id: string;
  layout_name: string;
  layout_config: Record<string, unknown>;
  is_default: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayoutInput {
  layout_name: string;
  layout_config: Record<string, unknown>;
  is_default?: boolean;
}

export interface DashboardWidget {
  id: string;
  layout_id: string;
  tenant_id: string;
  widget_key: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  settings: Record<string, unknown>;
  is_visible: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidgetInput {
  widget_key: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  settings?: Record<string, unknown>;
  is_visible?: boolean;
}
