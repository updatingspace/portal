/**
 * PrivacySettings - Settings tab for privacy preferences
 */
import { RadioGroup } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import type { PrivacySettings as PrivacyData, ProfileVisibility } from '../../types';
import { SettingsSection } from './SettingsSection';
import { PrivacyToggle } from './PrivacyToggle';
import './settings.css';

export interface PrivacySettingsProps {
  privacy: PrivacyData;
  onChange: (privacy: Partial<PrivacyData>) => void;
  disabled?: boolean;
}

export function PrivacySettings({
  privacy,
  onChange,
  disabled,
}: PrivacySettingsProps) {
  const { t } = usePersonalizationI18n();
  const VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; content: string }> = [
    { value: 'public', content: t('privacy.visibility.public') },
    { value: 'members', content: t('privacy.visibility.members') },
    { value: 'private', content: t('privacy.visibility.private') },
  ];
  const handleVisibilityChange = useCallback(
    (value: string) => {
      onChange({ profile_visibility: value as ProfileVisibility });
    },
    [onChange]
  );

  const handleShowOnlineStatusChange = useCallback(
    (show_online_status: boolean) => {
      onChange({ show_online_status });
    },
    [onChange]
  );

  const handleShowVoteHistoryChange = useCallback(
    (show_vote_history: boolean) => {
      onChange({ show_vote_history });
    },
    [onChange]
  );

  const handleShareActivityChange = useCallback(
    (share_activity: boolean) => {
      onChange({ share_activity });
    },
    [onChange]
  );

  const handleAllowMentionsChange = useCallback(
    (allow_mentions: boolean) => {
      onChange({ allow_mentions });
    },
    [onChange]
  );

  const handleAnalyticsEnabledChange = useCallback(
    (analytics_enabled: boolean) => {
      onChange({ analytics_enabled });
    },
    [onChange]
  );

  const handleRecommendationsEnabledChange = useCallback(
    (recommendations_enabled: boolean) => {
      onChange({ recommendations_enabled });
    },
    [onChange]
  );

  return (
    <div data-testid="privacy-settings">
      {/* Profile Visibility */}
      <SettingsSection
        title={t('privacy.sections.visibility.title')}
        description={t('privacy.sections.visibility.description')}
        testId="section-visibility"
      >
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <RadioGroup
            name="profile-visibility"
            value={privacy.profile_visibility}
            onUpdate={handleVisibilityChange}
            options={VISIBILITY_OPTIONS}
            disabled={disabled}
            size="m"
            data-testid="visibility-radio"
          />
        </div>
      </SettingsSection>

      {/* Online Status */}
      <SettingsSection
        title={t('privacy.sections.activity.title')}
        description={t('privacy.sections.activity.description')}
        testId="section-activity"
      >
        <PrivacyToggle
          label={t('privacy.toggles.onlineStatus.label')}
          description={t('privacy.toggles.onlineStatus.description')}
          value={privacy.show_online_status}
          onChange={handleShowOnlineStatusChange}
          disabled={disabled}
          testId="toggle-online-status"
        />
        <PrivacyToggle
          label={t('privacy.toggles.voteHistory.label')}
          description={t('privacy.toggles.voteHistory.description')}
          value={privacy.show_vote_history}
          onChange={handleShowVoteHistoryChange}
          disabled={disabled}
          testId="toggle-vote-history"
        />
        <PrivacyToggle
          label={t('privacy.toggles.shareActivity.label')}
          description={t('privacy.toggles.shareActivity.description')}
          value={privacy.share_activity}
          onChange={handleShareActivityChange}
          disabled={disabled}
          testId="toggle-share-activity"
        />
      </SettingsSection>

      {/* Interactions */}
      <SettingsSection
        title={t('privacy.sections.interactions.title')}
        description={t('privacy.sections.interactions.description')}
        testId="section-interactions"
      >
        <PrivacyToggle
          label={t('privacy.toggles.mentions.label')}
          description={t('privacy.toggles.mentions.description')}
          value={privacy.allow_mentions}
          onChange={handleAllowMentionsChange}
          disabled={disabled}
          testId="toggle-allow-mentions"
        />
      </SettingsSection>

      {/* Data & Personalization */}
      <SettingsSection
        title={t('privacy.sections.data.title')}
        description={t('privacy.sections.data.description')}
        testId="section-data"
      >
        <PrivacyToggle
          label={t('privacy.toggles.analytics.label')}
          description={t('privacy.toggles.analytics.description')}
          value={privacy.analytics_enabled}
          onChange={handleAnalyticsEnabledChange}
          disabled={disabled}
          testId="toggle-analytics"
        />
        <PrivacyToggle
          label={t('privacy.toggles.recommendations.label')}
          description={t('privacy.toggles.recommendations.description')}
          value={privacy.recommendations_enabled}
          onChange={handleRecommendationsEnabledChange}
          disabled={disabled}
          testId="toggle-recommendations"
        />
      </SettingsSection>
    </div>
  );
}
