/**
 * PrivacyToggle - Boolean privacy setting toggle
 */
import { Switch, Text } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import './settings.css';

export interface PrivacyToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

export function PrivacyToggle({
  label,
  description,
  value,
  onChange,
  disabled,
  testId,
}: PrivacyToggleProps) {
  const { t } = usePersonalizationI18n();

  const handleChange = useCallback(
    (checked: boolean) => {
      onChange(checked);
    },
    [onChange]
  );

  return (
    <div className="settings-row">
      <div className="settings-row__info">
        <Text variant="body-1" className="settings-row__label">
          {label}
        </Text>
        {description && (
          <Text variant="caption-1" color="secondary" className="settings-row__description">
            {description}
          </Text>
        )}
      </div>
      
      <div className="settings-row__control">
        <Switch
          checked={value}
          onUpdate={handleChange}
          disabled={disabled}
          size="m"
          aria-label={`${label}: ${value ? t('userSettings.common.enabled') : t('userSettings.common.disabled')}`}
          data-testid={testId ?? `privacy-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      </div>
    </div>
  );
}
