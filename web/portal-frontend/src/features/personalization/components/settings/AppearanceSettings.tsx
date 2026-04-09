/**
 * AppearanceSettings - Settings tab for visual preferences
 */
import { Text } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import type { AppearanceSettings as AppearanceData, LocalizationSettings } from '../../types';
import { SettingsSection } from './SettingsSection';
import { ThemeSelector } from './ThemeSelector';
import { ThemeSourceSelector } from './ThemeSourceSelector';
import { LanguageSelector } from './LanguageSelector';
import { TimezoneSelector } from './TimezoneSelector';
import { FontSizeSelector } from './FontSizeSelector';
import { ColorPicker } from './ColorPicker';
import { PrivacyToggle } from './PrivacyToggle';
import './settings.css';

export interface AppearanceSettingsProps {
  appearance: AppearanceData;
  localization: LocalizationSettings;
  onAppearanceChange: (appearance: Partial<AppearanceData>) => void;
  onLocalizationChange: (localization: Partial<LocalizationSettings>) => void;
  disabled?: boolean;
  canInheritThemeFromId?: boolean;
}

export function AppearanceSettings({
  appearance,
  localization,
  onAppearanceChange,
  onLocalizationChange,
  disabled,
  canInheritThemeFromId = false,
}: AppearanceSettingsProps) {
  const { t } = usePersonalizationI18n();
  const handleThemeChange = useCallback(
    (theme: AppearanceData['theme']) => {
      onAppearanceChange({ theme });
    },
    [onAppearanceChange]
  );

  const handleAccentColorChange = useCallback(
    (accent_color: string) => {
      onAppearanceChange({ accent_color });
    },
    [onAppearanceChange]
  );

  const handleFontSizeChange = useCallback(
    (font_size: AppearanceData['font_size']) => {
      onAppearanceChange({ font_size });
    },
    [onAppearanceChange]
  );

  const handleHighContrastChange = useCallback(
    (high_contrast: boolean) => {
      onAppearanceChange({ high_contrast });
    },
    [onAppearanceChange]
  );

  const handleReduceMotionChange = useCallback(
    (reduce_motion: boolean) => {
      onAppearanceChange({ reduce_motion });
    },
    [onAppearanceChange]
  );

  const handleLanguageChange = useCallback(
    (language: LocalizationSettings['language']) => {
      onLocalizationChange({ language });
    },
    [onLocalizationChange]
  );

  const handleThemeSourceChange = useCallback(
    (theme_source: AppearanceData['theme_source']) => {
      onAppearanceChange({ theme_source });
    },
    [onAppearanceChange]
  );

  const handleTimezoneChange = useCallback(
    (timezone: string) => {
      onLocalizationChange({ timezone });
    },
    [onLocalizationChange]
  );

  return (
    <div data-testid="appearance-settings">
      {/* Theme Section */}
      <SettingsSection
        title={t('appearance.sections.theme.title')}
        description={t('appearance.sections.theme.description')}
        testId="section-theme"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              {t('appearance.labels.colorScheme')}
            </Text>
            <Text variant="caption-1" color="secondary" className="settings-row__description">
              {t('appearance.labels.colorSchemeDescription')}
            </Text>
          </div>
        </div>
        {canInheritThemeFromId ? (
          <div className="settings-row">
            <div className="settings-row__info">
              <Text variant="body-1" className="settings-row__label">
                {t('appearance.labels.themeSource')}
              </Text>
              <Text variant="caption-1" color="secondary" className="settings-row__description">
                {t('appearance.labels.themeSourceDescription')}
              </Text>
            </div>
            <div className="settings-row__control">
              <ThemeSourceSelector
                value={appearance.theme_source}
                onChange={handleThemeSourceChange}
                disabled={disabled}
              />
            </div>
          </div>
        ) : null}
        <ThemeSelector
          value={appearance.theme}
          onChange={handleThemeChange}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Accent Color Section */}
      <SettingsSection
        title={t('appearance.sections.accent.title')}
        description={t('appearance.sections.accent.description')}
        testId="section-accent"
      >
        <ColorPicker
          value={appearance.accent_color}
          onChange={handleAccentColorChange}
          disabled={disabled}
        />
        <Text variant="caption-1" color="secondary">
          {t('appearance.labels.accentPreviewDescription')}
        </Text>
      </SettingsSection>

      {/* Typography Section */}
      <SettingsSection
        title={t('appearance.sections.typography.title')}
        description={t('appearance.sections.typography.description')}
        testId="section-typography"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              {t('appearance.labels.fontSize')}
            </Text>
          </div>
        </div>
        <FontSizeSelector
          value={appearance.font_size}
          onChange={handleFontSizeChange}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Accessibility Section */}
      <SettingsSection
        title={t('appearance.sections.accessibility.title')}
        description={t('appearance.sections.accessibility.description')}
        testId="section-accessibility"
      >
        <PrivacyToggle
          label={t('appearance.labels.highContrast')}
          description={t('appearance.labels.highContrastDescription')}
          value={appearance.high_contrast}
          onChange={handleHighContrastChange}
          disabled={disabled}
          testId="toggle-high-contrast"
        />
        <PrivacyToggle
          label={t('appearance.labels.reduceMotion')}
          description={t('appearance.labels.reduceMotionDescription')}
          value={appearance.reduce_motion}
          onChange={handleReduceMotionChange}
          disabled={disabled}
          testId="toggle-reduce-motion"
        />
      </SettingsSection>

      {/* Localization Section */}
      <SettingsSection
        title={t('appearance.sections.localization.title')}
        description={t('appearance.sections.localization.description')}
        testId="section-localization"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              {t('appearance.labels.interfaceLanguage')}
            </Text>
          </div>
          <div className="settings-row__control">
            <LanguageSelector
              value={localization.language}
              onChange={handleLanguageChange}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              {t('appearance.labels.timezone')}
            </Text>
            <Text variant="caption-1" color="secondary" className="settings-row__description">
              {t('appearance.labels.timezoneDescription')}
            </Text>
          </div>
          <div className="settings-row__control">
            <TimezoneSelector
              value={localization.timezone}
              onChange={handleTimezoneChange}
              disabled={disabled}
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
