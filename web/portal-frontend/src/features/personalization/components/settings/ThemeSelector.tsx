/**
 * ThemeSelector - Theme selection component (light/dark/auto)
 */
import { Icon, Text } from '@gravity-ui/uikit';
import { Moon, Sun, Display } from '@gravity-ui/icons';
import { useCallback } from 'react';

import type { Theme } from '../../types';
import './settings.css';

export interface ThemeSelectorProps {
  value: Theme;
  onChange: (theme: Theme) => void;
  disabled?: boolean;
}

interface ThemeOptionConfig {
  value: Theme;
  label: string;
  labelRu: string;
  icon: typeof Sun;
  description: string;
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  {
    value: 'light',
    label: 'Light',
    labelRu: 'Светлая',
    icon: Sun,
    description: 'Always use light theme',
  },
  {
    value: 'dark',
    label: 'Dark',
    labelRu: 'Тёмная',
    icon: Moon,
    description: 'Always use dark theme',
  },
  {
    value: 'auto',
    label: 'Auto',
    labelRu: 'Авто',
    icon: Display,
    description: 'Follow system preference',
  },
];

export function ThemeSelector({ value, onChange, disabled }: ThemeSelectorProps) {
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
    <div className="theme-selector" role="radiogroup" aria-label="Theme selection">
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
          aria-label={`${option.label} theme: ${option.description}`}
          data-testid={`theme-option-${option.value}`}
        >
          <div className="theme-option__icon">
            <Icon data={option.icon} size={24} />
          </div>
          <Text variant="body-1">{option.label}</Text>
        </button>
      ))}
    </div>
  );
}
