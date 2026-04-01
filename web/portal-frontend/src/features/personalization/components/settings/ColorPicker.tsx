/**
 * ColorPicker - Accent color picker with presets
 */
import { TextInput } from '@gravity-ui/uikit';
import { useCallback, useState } from 'react';

import './settings.css';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const COLOR_PRESETS = [
  { value: '#8B5CF6', name: 'Purple' },
  { value: '#3B82F6', name: 'Blue' },
  { value: '#10B981', name: 'Green' },
  { value: '#F59E0B', name: 'Amber' },
  { value: '#EF4444', name: 'Red' },
  { value: '#EC4899', name: 'Pink' },
  { value: '#6366F1', name: 'Indigo' },
  { value: '#14B8A6', name: 'Teal' },
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
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
        aria-label={`Current color: ${value}`}
      />
      
      <TextInput
        value={inputValue}
        onChange={handleInputChange}
        disabled={disabled}
        size="m"
        placeholder="#8B5CF6"
        aria-label="Hex color value"
        data-testid="color-input"
        style={{ width: 100 }}
      />

      <div className="color-picker__presets" role="listbox" aria-label="Color presets">
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
            aria-label={`${preset.name} (${preset.value})`}
            data-testid={`color-preset-${preset.name.toLowerCase()}`}
          />
        ))}
      </div>
    </div>
  );
}
