import { Text } from '@gravity-ui/uikit';

import { usePersonalizationI18n } from '../../i18n';
import type { ThemeSource } from '../../types';
import './settings.css';

export interface ThemeSourceSelectorProps {
  value: ThemeSource;
  onChange: (value: ThemeSource) => void;
  disabled?: boolean;
}

const OPTIONS: ThemeSource[] = ['portal', 'id'];

export function ThemeSourceSelector({ value, onChange, disabled }: ThemeSourceSelectorProps) {
  const { t } = usePersonalizationI18n();

  return (
    <div className="theme-source-selector" role="radiogroup" aria-label={t('appearance.labels.themeSource')}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={`theme-source-option${value === option ? ' theme-source-option--selected' : ''}`}
          onClick={() => onChange(option)}
          disabled={disabled}
          role="radio"
          aria-checked={value === option}
          data-testid={`theme-source-${option}`}
        >
          <Text variant="body-1">{t(`theme.source.${option}.label`)}</Text>
          <Text variant="caption-1" color="secondary">
            {t(`theme.source.${option}.description`)}
          </Text>
        </button>
      ))}
    </div>
  );
}
