/**
 * UserSettingsPanel - Main component for user personalization settings
 * Integrates all settings tabs with form validation and auto-save
 */
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useCallback, useState } from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePreferences } from '../hooks/usePreferences';
import { usePersonalizationI18n } from '../i18n';
import { useFormatters } from '@/shared/hooks/useFormatters';
import type { PreferencesUpdatePayload } from '../types';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { NotificationsSettings } from './settings/NotificationsSettings';
import { PrivacySettings } from './settings/PrivacySettings';
import './settings/settings.css';

interface UserSettingsPanelProps {
  className?: string;
}

type TabId = 'appearance' | 'notifications' | 'privacy';

export function UserSettingsPanel({ className }: UserSettingsPanelProps) {
  const { user } = useAuth();
  const { formatTime } = useFormatters();
  const [activeTab, setActiveTab] = useState<TabId>('appearance');
  const { t } = usePersonalizationI18n();
  const tabs: Array<{ id: TabId; title: string; description: string }> = [
    {
      id: 'appearance',
      title: t('userSettings.tabs.appearance.title'),
      description: t('userSettings.tabs.appearance.description'),
    },
    {
      id: 'notifications',
      title: t('userSettings.tabs.notifications.title'),
      description: t('userSettings.tabs.notifications.description'),
    },
    {
      id: 'privacy',
      title: t('userSettings.tabs.privacy.title'),
      description: t('userSettings.tabs.privacy.description'),
    },
  ];
  
  const {
    preferences,
    updateAppearance,
    updateLocalization,
    updateNotifications,
    updatePrivacy,
    resetToDefaults,
    isLoading,
    isError,
    error,
    isSaving,
    isResetting,
  } = usePreferences();

  // Form state for pending changes
  const [formData, setFormData] = useState<PreferencesUpdatePayload>({});

  // Auto-save hook
  const autoSave = useAutoSave({
    data: formData,
    onSave: async (data) => {
      const promises: Promise<void>[] = [];
      
      if (data.appearance) {
        promises.push(updateAppearance(data.appearance));
      }
      if (data.localization) {
        promises.push(updateLocalization(data.localization));
      }
      if (data.notifications) {
        promises.push(updateNotifications(data.notifications));
      }
      if (data.privacy) {
        promises.push(updatePrivacy(data.privacy));
      }
      
      await Promise.all(promises);
      setFormData({}); // Clear pending changes
    },
    delay: 1000, // 1 second debounce
  });

  // Handle preference updates
  const handleAppearanceChange = useCallback((appearance: PreferencesUpdatePayload['appearance']) => {
    setFormData(prev => ({ ...prev, appearance: { ...prev.appearance, ...appearance } }));
  }, []);

  const handleLocalizationChange = useCallback((localization: PreferencesUpdatePayload['localization']) => {
    setFormData(prev => ({ ...prev, localization: { ...prev.localization, ...localization } }));
  }, []);

  const handleNotificationsChange = useCallback((notifications: PreferencesUpdatePayload['notifications']) => {
    setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, ...notifications } }));
  }, []);

  const handlePrivacyChange = useCallback((privacy: PreferencesUpdatePayload['privacy']) => {
    setFormData(prev => ({ ...prev, privacy: { ...prev.privacy, ...privacy } }));
  }, []);

  const handleReset = useCallback(async () => {
    await resetToDefaults();
    setFormData({});
  }, [resetToDefaults]);

  const handleSaveNow = useCallback(async () => {
    await autoSave.save();
  }, [autoSave]);

  if (isLoading) {
    return (
      <Card className={`user-settings-panel ${className || ''}`}>
        <div className="user-settings-panel__loading">
            <Text variant="body-2" color="secondary">
              {t('userSettings.state.loading')}
            </Text>
        </div>
      </Card>
    );
  }

  if (isError || !preferences) {
    return (
      <Card className={`user-settings-panel ${className || ''}`}>
        <div className="user-settings-panel__error">
            <Text variant="body-2" color="danger">
              {t('userSettings.state.failed')}: {error?.message || t('userSettings.state.unknownError')}
            </Text>
            <Button onClick={() => window.location.reload()}>{t('userSettings.state.retry')}</Button>
        </div>
      </Card>
    );
  }

  // Merge preferences with pending changes
  const currentAppearance = {
    ...preferences.appearance,
    ...formData.appearance,
    theme_source: formData.appearance?.theme_source ?? preferences.appearance.theme_source ?? 'portal',
  };
  const currentLocalization = { ...preferences.localization, ...formData.localization };
  const currentNotifications = { ...preferences.notifications, ...formData.notifications };
  const currentPrivacy = { ...preferences.privacy, ...formData.privacy };

  const isDisabled = isSaving || isResetting;
  const hasUnsavedChanges = autoSave.isDirty;

  return (
    <Card className={`user-settings-panel ${className || ''}`}>
      {/* Header with save status */}
      <div className="user-settings-panel__header">
        <div className="user-settings-panel__title">
          <Text variant="header-1">{t('userSettings.header.title')}</Text>
          <Text variant="body-2" color="secondary">
            {t('userSettings.header.subtitle')}
          </Text>
        </div>
        
        <div className="user-settings-panel__status">
          {autoSave.isSaving && (
              <Text variant="caption-2" color="info">
                {t('userSettings.state.saving')}
              </Text>
            )}
            {autoSave.lastSaved && !hasUnsavedChanges && (
              <Text variant="caption-2" color="positive">
                {t('userSettings.state.saved')} {formatTime(autoSave.lastSaved)}
              </Text>
            )}
            {hasUnsavedChanges && !autoSave.isSaving && (
              <Text variant="caption-2" color="warning">
                {t('userSettings.state.unsaved')}
              </Text>
            )}
            {autoSave.error && (
              <Text variant="caption-2" color="danger">
                {t('userSettings.state.saveFailed')}
              </Text>
            )}
        </div>
        
        <div className="user-settings-panel__actions">
          {hasUnsavedChanges && (
            <Button 
              onClick={handleSaveNow} 
              disabled={isDisabled}
              size="s"
              variant="action"
            >
              {t('userSettings.actions.saveNow')}
            </Button>
          )}
          <Button
            onClick={handleReset}
            disabled={isDisabled}
            size="s"
            variant="outlined-danger"
          >
            {t('userSettings.actions.resetDefaults')}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="user-settings-panel__tabs">
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Text variant="body-1">{tab.title}</Text>
              <Text variant="caption-1" color="secondary">{tab.description}</Text>
            </button>
          ))}
        </div>
        
        <div className="user-settings-panel__content">
          {activeTab === 'appearance' && (
            <AppearanceSettings
              appearance={currentAppearance}
              localization={currentLocalization}
              onAppearanceChange={handleAppearanceChange}
              onLocalizationChange={handleLocalizationChange}
              disabled={isDisabled}
              canInheritThemeFromId={Boolean(user?.idTheme)}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationsSettings
              notifications={currentNotifications}
              onChange={handleNotificationsChange}
              disabled={isDisabled}
            />
          )}
          {activeTab === 'privacy' && (
            <PrivacySettings
              privacy={currentPrivacy}
              onChange={handlePrivacyChange}
              disabled={isDisabled}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
