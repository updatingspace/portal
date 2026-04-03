/**
 * ColorPicker - Accent color picker with presets
 */
import { TextInput } from '@gravity-ui/uikit';
import { useCallback, useState } from 'react';

import { usePersonalizationI18n } from '../../i18n';
import './settings.css';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const COLOR_PRESETS = [
  { value: '#8B5CF6', nameKey: 'colors.purple' },
  { value: '#3B82F6', nameKey: 'colors.blue' },
  { value: '#10B981', nameKey: 'colors.green' },
  { value: '#F59E0B', nameKey: 'colors.amber' },
  { value: '#EF4444', nameKey: 'colors.red' },
  { value: '#EC4899', nameKey: 'colors.pink' },
  { value: '#6366F1', nameKey: 'colors.indigo' },
  { value: '#14B8A6', nameKey: 'colors.teal' },
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const { t } = usePersonalizationI18n();
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      
      if (HEX_COLOR_REGEX.test(newValue)) {
        onChange(newValue.toUpperCase());
      }
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setInputValue(color);
      onChange(color);
    },
    [onChange]
  );

  const handlePresetKeyDown = useCallback(
    (color: string, event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handlePresetClick(color);
      }
    },
    [handlePresetClick]
  );

  return (
    <div className="color-picker">
      <div
        className="color-picker__swatch"
        style={{ backgroundColor: value }}
        aria-label={`${t('colors.aria.current')}: ${value}`}
      />
      
      <TextInput
        value={inputValue}
        onChange={handleInputChange}
        disabled={disabled}
        size="m"
        placeholder="#8B5CF6"
        aria-label={t('colors.aria.input')}
        data-testid="color-input"
        style={{ width: 100 }}
      />

      <div className="color-picker__presets" role="listbox" aria-label={t('colors.aria.presets')}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`color-picker__preset ${
              value.toUpperCase() === preset.value.toUpperCase()
                ? 'color-picker__preset--selected'
                : ''
            }`}
            style={{ backgroundColor: preset.value }}
            onClick={() => handlePresetClick(preset.value)}
            onKeyDown={(e) => handlePresetKeyDown(preset.value, e)}
            disabled={disabled}
            role="option"
            aria-selected={value.toUpperCase() === preset.value.toUpperCase()}
            aria-label={`${t(preset.nameKey)} (${preset.value})`}
            data-testid={`color-preset-${preset.value.slice(1).toLowerCase()}`}
          />
        ))}
      </div>
    </div>
  );
}
