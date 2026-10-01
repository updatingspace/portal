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
import { usePreferences } from '../hooks/usePreferences';
import { usePersonalizationI18n } from '../i18n';
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
    saveError,
    retrySave,
  } = usePreferences({ userId: user?.id, tenantId: user?.tenant?.id });

  // Form state for pending changes
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const apply = useCallback(
    (changes: PreferencesUpdatePayload) => {
      // The shared writer applies locally now and persists even if this page unmounts.
      void savePreferences(changes).catch(() => {
        /* Displayed by the shared error state below. */
      });
    },
    [savePreferences],
  );
  const handleAppearanceChange = (
    appearance: PreferencesUpdatePayload['appearance'],
  ) => apply({ appearance });
  const handleLocalizationChange = (
    localization: PreferencesUpdatePayload['localization'],
  ) => apply({ localization });
  const handleNotificationsChange = (
    notifications: PreferencesUpdatePayload['notifications'],
  ) => apply({ notifications });
  const handlePrivacyChange = (privacy: PreferencesUpdatePayload['privacy']) =>
    apply({ privacy });

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

  const isDisabled = isResetting;

  return (
    <section className={`user-settings-panel ${className || ''}`}>
      {!section && (
        <div className="user-settings-panel__header">
          <div className="user-settings-panel__title">
            <Text variant="header-1">{t('userSettings.header.title')}</Text>
            <Text variant="body-2" color="secondary">
              {t('userSettings.header.subtitle')}
            </Text>
          </div>
          <Button
            onClick={() => {
              setResetError(null);
              setResetOpen(true);
            }}
            disabled={isDisabled}
            size="s"
            view="outlined-danger"
          >
            {t('userSettings.actions.resetDefaults')}
          </Button>
        </div>
      )}
      {saveError && (
        <InlineError
          onRetry={() => {
            void retrySave().catch(() => {});
          }}
        >
          {ui(
            'Не удалось синхронизировать настройки. Ваш выбор сохранён на этом устройстве.',
            'Could not sync settings. Your choice is kept on this device.',
          )}
        </InlineError>
      )}

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
              appearance={{
                ...preferences.appearance,
                theme_source: preferences.appearance.theme_source ?? 'portal',
              }}
              localization={preferences.localization}
              onAppearanceChange={handleAppearanceChange}
              onLocalizationChange={handleLocalizationChange}
              disabled={isDisabled}
              canInheritThemeFromId={Boolean(user?.idTheme)}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationsSettings
              notifications={preferences.notifications}
              onChange={handleNotificationsChange}
              disabled={isDisabled}
            />
          )}
          {activeTab === 'privacy' && (
            <PrivacySettings
              privacy={preferences.privacy}
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
            disabled={isResetting}
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
            await resetToDefaults();
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
