/**
 * FontSizeSelector - Font size selection (small/medium/large)
 */
import { Text } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import type { FontSize } from '../../types';
import './settings.css';

export interface FontSizeSelectorProps {
  value: FontSize;
  onChange: (size: FontSize) => void;
  disabled?: boolean;
}

interface FontSizeConfig {
  value: FontSize;
  label: string;
  preview: string;
}

const FONT_SIZE_OPTIONS: FontSizeConfig[] = [
  { value: 'small', label: 'Small', preview: 'Aa' },
  { value: 'medium', label: 'Medium', preview: 'Aa' },
  { value: 'large', label: 'Large', preview: 'Aa' },
];

export function FontSizeSelector({ value, onChange, disabled }: FontSizeSelectorProps) {
  const handleKeyDown = useCallback(
    (size: FontSize, event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onChange(size);
      }
    },
    [onChange]
  );

  return (
    <div className="font-size-selector" role="radiogroup" aria-label="Font size selection">
      {FONT_SIZE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`font-size-option font-size-option--${option.value} ${
            value === option.value ? 'font-size-option--selected' : ''
          }`}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => handleKeyDown(option.value, e)}
          disabled={disabled}
          role="radio"
          aria-checked={value === option.value}
          aria-label={`${option.label} font size`}
          data-testid={`font-size-${option.value}`}
        >
          <span className="font-size-option__preview">{option.preview}</span>
          <Text variant="caption-2">{option.label}</Text>
        </button>
      ))}
    </div>
  );
}
