/**
 * NotificationsSettings - Settings tab for notification preferences
 */
import { Select, Switch, Text, TextInput } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
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

export function NotificationsSettings({
  notifications,
  onChange,
  disabled,
}: NotificationsSettingsProps) {
  const { t } = usePersonalizationI18n();
  const DIGEST_OPTIONS = [
    { value: 'instant', content: t('notifications.digest.instant') },
    { value: 'hourly', content: t('notifications.digest.hourly') },
    { value: 'daily', content: t('notifications.digest.daily') },
    { value: 'weekly', content: t('notifications.digest.weekly') },
  ];
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
        title={t('notifications.sections.channels.title')}
        description={t('notifications.sections.channels.description')}
        testId="section-channels"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
               {t('notifications.labels.emailNotifications')}
             </Text>
             <Text variant="caption-1" color="secondary" className="settings-row__description">
               {t('notifications.labels.emailDescription')}
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
          label={t('notifications.labels.inAppNotifications')}
          description={t('notifications.labels.inAppDescription')}
          value={notifications.in_app.enabled}
          onChange={handleInAppEnabledChange}
          disabled={disabled}
          testId="toggle-in-app"
        />
      </SettingsSection>

      {/* Polls Notifications */}
      <SettingsSection
        title={t('notifications.sections.polls.title')}
        description={t('notifications.sections.polls.description')}
        testId="section-polls"
      >
        <NotificationToggle
          label={t('notifications.toggles.pollsNew.label')}
          description={t('notifications.toggles.pollsNew.description')}
          value={getTypeConfig('polls', 'new_vote')}
          onChange={(config) => handleNotificationTypeChange('polls', 'new_vote', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.pollsClosing.label')}
          description={t('notifications.toggles.pollsClosing.description')}
          value={getTypeConfig('polls', 'closing_soon')}
          onChange={(config) => handleNotificationTypeChange('polls', 'closing_soon', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.pollsResults.label')}
          description={t('notifications.toggles.pollsResults.description')}
          value={getTypeConfig('polls', 'results_published')}
          onChange={(config) => handleNotificationTypeChange('polls', 'results_published', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Events Notifications */}
      <SettingsSection
        title={t('notifications.sections.events.title')}
        description={t('notifications.sections.events.description')}
        testId="section-events"
      >
        <NotificationToggle
          label={t('notifications.toggles.eventsNew.label')}
          description={t('notifications.toggles.eventsNew.description')}
          value={getTypeConfig('events', 'new_event')}
          onChange={(config) => handleNotificationTypeChange('events', 'new_event', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.eventsRsvp.label')}
          description={t('notifications.toggles.eventsRsvp.description')}
          value={getTypeConfig('events', 'rsvp_reminder')}
          onChange={(config) => handleNotificationTypeChange('events', 'rsvp_reminder', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.eventsStarting.label')}
          description={t('notifications.toggles.eventsStarting.description')}
          value={getTypeConfig('events', 'event_starting')}
          onChange={(config) => handleNotificationTypeChange('events', 'event_starting', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Community Notifications */}
      <SettingsSection
        title={t('notifications.sections.community.title')}
        description={t('notifications.sections.community.description')}
        testId="section-community"
      >
        <NotificationToggle
          label={t('notifications.toggles.communityMentions.label')}
          description={t('notifications.toggles.communityMentions.description')}
          value={getTypeConfig('community', 'mention')}
          onChange={(config) => handleNotificationTypeChange('community', 'mention', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.communityNewMembers.label')}
          description={t('notifications.toggles.communityNewMembers.description')}
          value={getTypeConfig('community', 'new_member')}
          onChange={(config) => handleNotificationTypeChange('community', 'new_member', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* System Notifications */}
      <SettingsSection
        title={t('notifications.sections.system.title')}
        description={t('notifications.sections.system.description')}
        testId="section-system"
      >
        <NotificationToggle
          label={t('notifications.toggles.systemSecurity.label')}
          description={t('notifications.toggles.systemSecurity.description')}
          value={getTypeConfig('system', 'security_alert')}
          onChange={(config) => handleNotificationTypeChange('system', 'security_alert', config)}
          disabled={disabled}
        />
        <NotificationToggle
          label={t('notifications.toggles.systemUpdates.label')}
          description={t('notifications.toggles.systemUpdates.description')}
          value={getTypeConfig('system', 'product_update')}
          onChange={(config) => handleNotificationTypeChange('system', 'product_update', config)}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Quiet Hours */}
      <SettingsSection
        title={t('notifications.sections.quietHours.title')}
        description={t('notifications.sections.quietHours.description')}
        testId="section-quiet-hours"
      >
        <PrivacyToggle
          label={t('notifications.labels.quietHoursEnable')}
          description={t('notifications.labels.quietHoursEnableDescription')}
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
                placeholder={t('notifications.quietHours.startPlaceholder')}
                aria-label={t('notifications.quietHours.startAria')}
                data-testid="quiet-hours-start"
              />
              <span className="quiet-hours__separator">{t('notifications.quietHours.separator')}</span>
              <TextInput
                value={notifications.quiet_hours.end}
                onChange={handleQuietHoursEndChange}
                disabled={disabled}
                size="m"
                placeholder={t('notifications.quietHours.endPlaceholder')}
                aria-label={t('notifications.quietHours.endAria')}
                data-testid="quiet-hours-end"
              />
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
