import { useUrlState } from '../../../shared/hooks/useUrlState';
import {
  ConfirmDialog,
  InlineError,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
/**
 * UserSettingsPanel - Main component for user personalization settings
 * Integrates all settings tabs with form validation and auto-save
 */
import { Button, Select, Text } from '@gravity-ui/uikit';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
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
  section?: TabId;
}

type TabId =
  | 'appearance'
  | 'localization'
  | 'accessibility'
  | 'notifications'
  | 'privacy';

export function UserSettingsPanel({
  className,
  section,
}: UserSettingsPanelProps) {
  const { user } = useAuth();
  const ui = useUITranslation();
  const mobile = useMediaQuery('(max-width: 719px)');
  const { formatTime } = useFormatters();
  const [urlTab, setActiveTab] = useUrlState<TabId>('tab', 'appearance', [
    'appearance',
    'notifications',
    'privacy',
  ]);
  const activeTab = section || urlTab;
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
    savePreferences,
    resetToDefaults,
    isLoading,
    isError,
    reload,
    isResetting,
  } = usePreferences({ userId: user?.id, tenantId: user?.tenant?.id });

  // Form state for pending changes
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PreferencesUpdatePayload>({});

  // Auto-save hook
  const autoSave = useAutoSave({
    data: formData,
    onSave: async (data) => {
      await savePreferences(data);
      // Keep the submitted delta as the clean baseline. Later edits remain dirty.
    },
    delay: 1000, // 1 second debounce
    enabled: !isResetting,
  });

  // Handle preference updates
  const handleAppearanceChange = useCallback(
    (appearance: PreferencesUpdatePayload['appearance']) => {
      setFormData((prev) => ({
        ...prev,
        appearance: { ...prev.appearance, ...appearance },
      }));
    },
    [],
  );

  const handleLocalizationChange = useCallback(
    (localization: PreferencesUpdatePayload['localization']) => {
      setFormData((prev) => ({
        ...prev,
        localization: { ...prev.localization, ...localization },
      }));
    },
    [],
  );

  const handleNotificationsChange = useCallback(
    (notifications: PreferencesUpdatePayload['notifications']) => {
      setFormData((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, ...notifications },
      }));
    },
    [],
  );

  const handlePrivacyChange = useCallback(
    (privacy: PreferencesUpdatePayload['privacy']) => {
      setFormData((prev) => ({
        ...prev,
        privacy: { ...prev.privacy, ...privacy },
      }));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    await resetToDefaults();
    setFormData({});
  }, [resetToDefaults]);

  const handleSaveNow = useCallback(async () => {
    await autoSave.save();
  }, [autoSave]);

  if (isLoading) {
    return (
      <section className={`user-settings-panel ${className || ''}`}>
        <div className="user-settings-panel__loading">
          <Text variant="body-2" color="secondary">
            {t('userSettings.state.loading')}
          </Text>
        </div>
      </section>
    );
  }

  if (isError || !preferences) {
    return (
      <section className={`user-settings-panel ${className || ''}`}>
        <InlineError onRetry={() => void reload()}>
          {t('userSettings.state.failed')}
        </InlineError>
      </section>
    );
  }

  // Merge preferences with pending changes
  const currentAppearance = {
    ...preferences.appearance,
    ...formData.appearance,
    theme_source:
      formData.appearance?.theme_source ??
      preferences.appearance.theme_source ??
      'portal',
  };
  const currentLocalization = {
    ...preferences.localization,
    ...formData.localization,
  };
  const currentNotifications = {
    ...preferences.notifications,
    ...formData.notifications,
  };
  const currentPrivacy = { ...preferences.privacy, ...formData.privacy };

  const isDisabled = isResetting;
  const hasUnsavedChanges = autoSave.isDirty;

  return (
    <section className={`user-settings-panel ${className || ''}`}>
      {/* Header with save status */}
      <div className="user-settings-panel__header">
        {!section && (
          <div className="user-settings-panel__title">
            <Text variant="header-1">{t('userSettings.header.title')}</Text>
            <Text variant="body-2" color="secondary">
              {t('userSettings.header.subtitle')}
            </Text>
          </div>
        )}
        <div className="user-settings-panel__status" role="status">
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
              view="action"
            >
              {t('userSettings.actions.saveNow')}
            </Button>
          )}
          {!section && (
            <Button
              onClick={handleReset}
              disabled={isDisabled || autoSave.isSaving}
              size="s"
              view="outlined-danger"
            >
              {t('userSettings.actions.resetDefaults')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="user-settings-panel__tabs">
        {!section &&
          (mobile ? (
            <Select
              size="xl"
              width="max"
              aria-label={t('userSettings.header.title')}
              value={[activeTab]}
              options={tabs.map((tab) => ({
                value: tab.id,
                content: tab.title,
              }))}
              onUpdate={(values) => {
                if (values[0]) setActiveTab(values[0] as TabId);
              }}
            />
          ) : (
            <div className="settings-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <Text variant="body-1">{tab.title}</Text>
                  <Text variant="caption-1" color="secondary">
                    {tab.description}
                  </Text>
                </button>
              ))}
            </div>
          ))}

        <div className="user-settings-panel__content">
          {(['appearance', 'localization', 'accessibility'] as const).some(
            (tab) => tab === activeTab,
          ) && (
            <AppearanceSettings
              section={
                section === 'localization' || section === 'accessibility'
                  ? section
                  : section
                    ? 'appearance'
                    : 'all'
              }
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
      {section === 'appearance' && (
        <details className="settings-disclosure settings-disclosure--advanced">
          <summary>
            <span>{t('userSettings.actions.resetDefaults')}</span>
          </summary>
          <Button
            size="xl"
            view="outlined-danger"
            onClick={() => {
              setResetError(null);
              setResetOpen(true);
            }}
            disabled={isResetting || autoSave.isSaving || autoSave.isDirty}
          >
            {t('userSettings.actions.resetDefaults')}
          </Button>
        </details>
      )}
      <ConfirmDialog
        open={resetOpen}
        pending={isResetting}
        error={resetError}
        title={t('userSettings.actions.resetDefaults')}
        description={ui(
          'Внешний вид, язык, уведомления и приватность вернутся к исходным значениям.',
          'Appearance, language, notifications and privacy will return to their defaults.',
        )}
        confirmLabel={t('userSettings.actions.resetDefaults')}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            await handleReset();
            setResetOpen(false);
          } catch {
            setResetError(
              ui(
                'Не удалось сбросить настройки. Попробуйте ещё раз.',
                'Could not reset settings. Try again.',
              ),
            );
          }
        }}
      />
    </section>
  );
}
