/**
 * ColorPicker - Accent color picker with presets
 */
import type { CSSProperties } from 'react';
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
  { value: '#2563EB', nameKey: 'colors.blue' },
  { value: '#0F766E', nameKey: 'colors.teal' },
  { value: '#059669', nameKey: 'colors.green' },
  { value: '#D97706', nameKey: 'colors.amber' },
  { value: '#DC2626', nameKey: 'colors.red' },
  { value: '#DB2777', nameKey: 'colors.pink' },
  { value: '#4F46E5', nameKey: 'colors.indigo' },
  { value: '#7C3AED', nameKey: 'colors.purple' },
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const { t } = usePersonalizationI18n();
  const [inputValue, setInputValue] = useState(value);
  const previewStyle = {
    '--color-picker-preview-accent': value,
  } as CSSProperties;

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
      <div className="color-picker__controls">
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
          placeholder="#2563EB"
          aria-label={t('colors.aria.input')}
          data-testid="color-input"
          style={{ width: 112 }}
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

      <div className="color-picker__preview" style={previewStyle} aria-hidden="true" data-testid="accent-preview">
        <div className="color-picker__preview-shell">
          <div className="color-picker__preview-header">
            <div className="color-picker__preview-pill color-picker__preview-pill--brand" />
            <div className="color-picker__preview-pill color-picker__preview-pill--ghost" />
          </div>
          <div className="color-picker__preview-body">
            <div className="color-picker__preview-card">
              <div className="color-picker__preview-placeholder color-picker__preview-placeholder--title" />
              <div className="color-picker__preview-placeholder" />
              <div className="color-picker__preview-placeholder color-picker__preview-placeholder--chip" />
            </div>
            <div className="color-picker__preview-card color-picker__preview-card--secondary">
              <div className="color-picker__preview-placeholder color-picker__preview-placeholder--short" />
              <div className="color-picker__preview-outline" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
