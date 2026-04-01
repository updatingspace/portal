/**
 * NotificationsSettings - Settings tab for notification preferences
 */
import { Select, Switch, Text, TextInput } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import type { EmailDigest, NotificationChannelConfig, NotificationSettings } from '../../types';
import { SettingsSection } from './SettingsSection';
import { NotificationToggle } from './NotificationToggle';
import { PrivacyToggle } from './PrivacyToggle';
import './settings.css';

export interface NotificationsSettingsProps {
  notifications: NotificationSettings;
  onChange: (notifications: Partial<NotificationSettings>) => void;
  disabled?: boolean;
}

const DIGEST_OPTIONS = [
  { value: 'instant', content: 'Instant — as they happen' },
  { value: 'hourly', content: 'Hourly digest' },
  { value: 'daily', content: 'Daily digest' },
  { value: 'weekly', content: 'Weekly digest' },
];

export function NotificationsSettings({
  notifications,
  onChange,
  disabled,
}: NotificationsSettingsProps) {
  // Channel toggles
  const handleEmailEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({
        email: { ...notifications.email, enabled },
      });
    },
    [notifications.email, onChange]
  );

  const handleEmailDigestChange = useCallback(
    (values: string[]) => {
      const digest = values[0] as EmailDigest;
      if (digest) {
        onChange({
          email: { ...notifications.email, digest },
        });
      }
    },
    [notifications.email, onChange]
  );

  const handleInAppEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({
        in_app: { enabled },
      });
    },
    [onChange]
  );

  // Notification type handlers
  const handleNotificationTypeChange = useCallback(
    (category: string, type: string, config: NotificationChannelConfig) => {
      const currentTypes = notifications.types ?? {};
      const currentCategory = currentTypes[category as keyof typeof currentTypes] ?? {};
      
      onChange({
        types: {
          ...currentTypes,
          [category]: {
            ...currentCategory,
            [type]: config,
          },
        },
      });
    },
    [notifications.types, onChange]
  );

  // Quiet hours handlers
  const handleQuietHoursEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({
        quiet_hours: { ...notifications.quiet_hours, enabled },
      });
    },
    [notifications.quiet_hours, onChange]
  );

  const handleQuietHoursStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        quiet_hours: { ...notifications.quiet_hours, start: e.target.value },
      });
    },
    [notifications.quiet_hours, onChange]
  );

  const handleQuietHoursEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        quiet_hours: { ...notifications.quiet_hours, end: e.target.value },
      });
    },
    [notifications.quiet_hours, onChange]
  );

  // Get notification config safely
  const getTypeConfig = (category: string, type: string): NotificationChannelConfig => {
    const types = notifications.types ?? {};
    const categoryTypes = types[category as keyof typeof types] ?? {};
    return (
      categoryTypes[type] ?? { enabled: true, channels: ['email', 'in_app'] }
    );
  };

  return (
    <div data-testid="notifications-settings">
      {/* Delivery Channels */}
      <SettingsSection
        title="Delivery Channels"
        description="Choose how you want to receive notifications"
        testId="section-channels"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              Email notifications
            </Text>
            <Text variant="caption-1" color="secondary" className="settings-row__description">
              Receive notifications via email
            </Text>
            {notifications.email.enabled && (
              <div style={{ marginTop: 8 }}>
                <Select
                  value={[notifications.email.digest]}
                  onUpdate={handleEmailDigestChange}
                  options={DIGEST_OPTIONS}
                  disabled={disabled}
                  size="m"
                  width={200}
                />
              </div>
            )}
          </div>
          <div className="settings-row__control">
            <Switch
              checked={notifications.email.enabled}
              onUpdate={handleEmailEnabledChange}
              disabled={disabled}
              size="m"
              data-testid="toggle-email"
            />
          </div>
        </div>

        <PrivacyToggle
          label="In-app notifications"
          description="Show notifications within the app"
          value={notifications.in_app.enabled}
          onChange={handleInAppEnabledChange}
          disabled={disabled}
          testId="toggle-in-app"
        />
      </SettingsSection>

      {/* Polls Notifications */}
      <SettingsSection
        title="Polls & Voting"
        description="Notifications about voting activities"
        testId="section-polls"
      >
        <NotificationToggle
          label="New polls"
          description="When a new poll opens for voting"
          value={getTypeConfig('polls', 'new_vote')}
          onChange={(config) => handleNotificationTypeChange('polls', 'new_vote', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="Closing soon"
          description="Reminder before a poll closes"
          value={getTypeConfig('polls', 'closing_soon')}
          onChange={(config) => handleNotificationTypeChange('polls', 'closing_soon', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="Results published"
          description="When poll results are announced"
          value={getTypeConfig('polls', 'results_published')}
          onChange={(config) => handleNotificationTypeChange('polls', 'results_published', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Events Notifications */}
      <SettingsSection
        title="Events"
        description="Notifications about community events"
        testId="section-events"
      >
        <NotificationToggle
          label="New events"
          description="When new events are scheduled"
          value={getTypeConfig('events', 'new_event')}
          onChange={(config) => handleNotificationTypeChange('events', 'new_event', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="RSVP reminders"
          description="Reminder to RSVP for upcoming events"
          value={getTypeConfig('events', 'rsvp_reminder')}
          onChange={(config) => handleNotificationTypeChange('events', 'rsvp_reminder', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="Event starting"
          description="Notification when an event is about to start"
          value={getTypeConfig('events', 'event_starting')}
          onChange={(config) => handleNotificationTypeChange('events', 'event_starting', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Community Notifications */}
      <SettingsSection
        title="Community"
        description="Social and community updates"
        testId="section-community"
      >
        <NotificationToggle
          label="Mentions"
          description="When someone @mentions you"
          value={getTypeConfig('community', 'mention')}
          onChange={(config) => handleNotificationTypeChange('community', 'mention', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="New members"
          description="When new members join the community"
          value={getTypeConfig('community', 'new_member')}
          onChange={(config) => handleNotificationTypeChange('community', 'new_member', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* System Notifications */}
      <SettingsSection
        title="System"
        description="Important system and security notifications"
        testId="section-system"
      >
        <NotificationToggle
          label="Security alerts"
          description="Important security notifications (recommended)"
          value={getTypeConfig('system', 'security_alert')}
          onChange={(config) => handleNotificationTypeChange('system', 'security_alert', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label="Product updates"
          description="New features and platform updates"
          value={getTypeConfig('system', 'product_update')}
          onChange={(config) => handleNotificationTypeChange('system', 'product_update', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Quiet Hours */}
      <SettingsSection
        title="Quiet Hours"
        description="Pause notifications during specific times"
        testId="section-quiet-hours"
      >
        <PrivacyToggle
          label="Enable quiet hours"
          description="Notifications will be held until quiet hours end"
          value={notifications.quiet_hours.enabled}
          onChange={handleQuietHoursEnabledChange}
          disabled={disabled}
          testId="toggle-quiet-hours"
        />
        
        {notifications.quiet_hours.enabled && (
          <div className="quiet-hours">
            <div className="quiet-hours__times">
              <TextInput
                value={notifications.quiet_hours.start}
                onChange={handleQuietHoursStartChange}
                disabled={disabled}
                size="m"
                placeholder="22:00"
                aria-label="Quiet hours start time"
                data-testid="quiet-hours-start"
              />
              <span className="quiet-hours__separator">to</span>
              <TextInput
                value={notifications.quiet_hours.end}
                onChange={handleQuietHoursEndChange}
                disabled={disabled}
                size="m"
                placeholder="08:00"
                aria-label="Quiet hours end time"
                data-testid="quiet-hours-end"
              />
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
