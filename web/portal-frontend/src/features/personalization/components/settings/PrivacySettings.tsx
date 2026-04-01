/**
 * PrivacySettings - Settings tab for privacy preferences
 */
import { RadioGroup } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import type { PrivacySettings as PrivacyData, ProfileVisibility } from '../../types';
import { SettingsSection } from './SettingsSection';
import { PrivacyToggle } from './PrivacyToggle';
import './settings.css';

export interface PrivacySettingsProps {
  privacy: PrivacyData;
  onChange: (privacy: Partial<PrivacyData>) => void;
  disabled?: boolean;
}

const VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; content: string }> = [
  { value: 'public', content: 'Public — visible to everyone' },
  { value: 'members', content: 'Members — community members only' },
  { value: 'private', content: 'Private — only you' },
];

export function PrivacySettings({
  privacy,
  onChange,
  disabled,
}: PrivacySettingsProps) {
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
        title="Profile Visibility"
        description="Control who can see your profile information"
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
        title="Activity & Presence"
        description="Control how your activity is displayed to others"
        testId="section-activity"
      >
        <PrivacyToggle
          label="Show online status"
          description="Let others see when you're online"
          value={privacy.show_online_status}
          onChange={handleShowOnlineStatusChange}
          disabled={disabled}
          testId="toggle-online-status"
        />
        <PrivacyToggle
          label="Show voting history"
          description="Display your past votes on your profile"
          value={privacy.show_vote_history}
          onChange={handleShowVoteHistoryChange}
          disabled={disabled}
          testId="toggle-vote-history"
        />
        <PrivacyToggle
          label="Share activity in feed"
          description="Your actions appear in the community activity feed"
          value={privacy.share_activity}
          onChange={handleShareActivityChange}
          disabled={disabled}
          testId="toggle-share-activity"
        />
      </SettingsSection>

      {/* Interactions */}
      <SettingsSection
        title="Interactions"
        description="Control how others can interact with you"
        testId="section-interactions"
      >
        <PrivacyToggle
          label="Allow @mentions"
          description="Let other users mention you in posts and comments"
          value={privacy.allow_mentions}
          onChange={handleAllowMentionsChange}
          disabled={disabled}
          testId="toggle-allow-mentions"
        />
      </SettingsSection>

      {/* Data & Personalization */}
      <SettingsSection
        title="Data & Personalization"
        description="Control how your data is used"
        testId="section-data"
      >
        <PrivacyToggle
          label="Usage analytics"
          description="Help improve the platform by sharing anonymous usage data"
          value={privacy.analytics_enabled}
          onChange={handleAnalyticsEnabledChange}
          disabled={disabled}
          testId="toggle-analytics"
        />
        <PrivacyToggle
          label="Personalized recommendations"
          description="Get recommendations based on your activity and preferences"
          value={privacy.recommendations_enabled}
          onChange={handleRecommendationsEnabledChange}
          disabled={disabled}
          testId="toggle-recommendations"
        />
      </SettingsSection>
    </div>
  );
}
