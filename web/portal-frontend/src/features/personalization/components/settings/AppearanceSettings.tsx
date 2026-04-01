/**
 * AppearanceSettings - Settings tab for visual preferences
 */
import { Text } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import type { AppearanceSettings as AppearanceData, LocalizationSettings } from '../../types';
import { SettingsSection } from './SettingsSection';
import { ThemeSelector } from './ThemeSelector';
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
}

export function AppearanceSettings({
  appearance,
  localization,
  onAppearanceChange,
  onLocalizationChange,
  disabled,
}: AppearanceSettingsProps) {
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
        title="Theme"
        description="Choose how the interface looks"
        testId="section-theme"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              Color scheme
            </Text>
            <Text variant="caption-1" color="secondary" className="settings-row__description">
              Select light, dark, or follow your system settings
            </Text>
          </div>
        </div>
        <ThemeSelector
          value={appearance.theme}
          onChange={handleThemeChange}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Accent Color Section */}
      <SettingsSection
        title="Accent Color"
        description="Personalize the interface highlight color"
        testId="section-accent"
      >
        <ColorPicker
          value={appearance.accent_color}
          onChange={handleAccentColorChange}
          disabled={disabled}
        />
      </SettingsSection>

      {/* Typography Section */}
      <SettingsSection
        title="Typography"
        description="Adjust text display settings"
        testId="section-typography"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              Font size
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
        title="Accessibility"
        description="Settings for visual accessibility"
        testId="section-accessibility"
      >
        <PrivacyToggle
          label="High contrast"
          description="Increase contrast for better visibility"
          value={appearance.high_contrast}
          onChange={handleHighContrastChange}
          disabled={disabled}
          testId="toggle-high-contrast"
        />
        <PrivacyToggle
          label="Reduce motion"
          description="Minimize animations and transitions"
          value={appearance.reduce_motion}
          onChange={handleReduceMotionChange}
          disabled={disabled}
          testId="toggle-reduce-motion"
        />
      </SettingsSection>

      {/* Localization Section */}
      <SettingsSection
        title="Language & Region"
        description="Set your language and timezone preferences"
        testId="section-localization"
      >
        <div className="settings-row">
          <div className="settings-row__info">
            <Text variant="body-1" className="settings-row__label">
              Interface language
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
              Timezone
            </Text>
            <Text variant="caption-1" color="secondary" className="settings-row__description">
              Used for displaying dates and event times
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
