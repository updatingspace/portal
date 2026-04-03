/**
 * ThemeSelector - Theme selection component (light/dark/auto)
 */
import { Icon, Text } from '@gravity-ui/uikit';
import { Moon, Sun, Display } from '@gravity-ui/icons';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import type { Theme } from '../../types';
import './settings.css';

export interface ThemeSelectorProps {
  value: Theme;
  onChange: (theme: Theme) => void;
  disabled?: boolean;
}

interface ThemeOptionConfig {
  value: Theme;
  icon: typeof Sun;
  labelPath: string;
  descriptionPath: string;
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  {
    value: 'light',
    icon: Sun,
    labelPath: 'theme.light.label',
    descriptionPath: 'theme.light.description',
  },
  {
    value: 'dark',
    icon: Moon,
    labelPath: 'theme.dark.label',
    descriptionPath: 'theme.dark.description',
  },
  {
    value: 'auto',
    icon: Display,
    labelPath: 'theme.auto.label',
    descriptionPath: 'theme.auto.description',
  },
];

export function ThemeSelector({ value, onChange, disabled }: ThemeSelectorProps) {
  const { t } = usePersonalizationI18n();

  const handleKeyDown = useCallback(
    (theme: Theme, event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onChange(theme);
      }
    },
    [onChange]
  );

  return (
    <div className="theme-selector" role="radiogroup" aria-label={t('theme.aria.group')}>
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-option theme-option--${option.value} ${
            value === option.value ? 'theme-option--selected' : ''
          }`}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => handleKeyDown(option.value, e)}
          disabled={disabled}
          role="radio"
          aria-checked={value === option.value}
          aria-label={`${t(option.labelPath)} ${t('theme.aria.option')}: ${t(option.descriptionPath)}`}
          data-testid={`theme-option-${option.value}`}
        >
          <div className="theme-option__icon">
            <Icon data={option.icon} size={24} />
          </div>
          <Text variant="body-1">{t(option.labelPath)}</Text>
        </button>
      ))}
    </div>
  );
}
