/**
 * NotificationToggle - Individual notification toggle with channels
 */
import { Switch, Text, Checkbox } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import type { NotificationChannel, NotificationChannelConfig } from '../../types';
import './settings.css';

export interface NotificationToggleProps {
  label: string;
  description?: string;
  value: NotificationChannelConfig;
  onChange: (config: NotificationChannelConfig) => void;
  availableChannels?: NotificationChannel[];
  disabled?: boolean;
}

export function NotificationToggle({
  label,
  description,
  value,
  onChange,
  availableChannels = ['email', 'in_app'],
  disabled,
}: NotificationToggleProps) {
  const { t } = usePersonalizationI18n();
  const handleEnabledChange = useCallback(
    (checked: boolean) => {
      onChange({
        ...value,
        enabled: checked,
        // If enabling, set default channels; if disabling, keep current
        channels: checked && value.channels.length === 0 ? availableChannels : value.channels,
      });
    },
    [value, onChange, availableChannels]
  );

  const handleChannelChange = useCallback(
    (channel: NotificationChannel, checked: boolean) => {
      const newChannels = checked
        ? [...value.channels, channel]
        : value.channels.filter((c) => c !== channel);
      
      onChange({
        ...value,
        channels: newChannels,
        // Auto-disable if no channels selected
        enabled: newChannels.length > 0,
      });
    },
    [value, onChange]
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
        
        {value.enabled && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            {availableChannels.map((channel) => (
                <Checkbox
                  key={channel}
                  content={t(`notifications.channels.${channel}`)}
                checked={value.channels.includes(channel)}
                onUpdate={(checked) => handleChannelChange(channel, checked)}
                disabled={disabled}
                size="m"
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="settings-row__control">
        <Switch
          checked={value.enabled}
          onUpdate={handleEnabledChange}
          disabled={disabled}
          size="m"
          aria-label={`${label} notifications ${value.enabled ? 'enabled' : 'disabled'}`}
          data-testid={`notification-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      </div>
    </div>
  );
}
