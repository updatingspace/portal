/**
 * LanguageSelector - Language selection dropdown
 */
import { Select, type SelectOption } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import type { Language } from '../../types';
import './settings.css';

export interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
}

interface LanguageConfig {
  value: Language;
  label: string;
  nativeLabel: string;
}

const LANGUAGE_OPTIONS: LanguageConfig[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ru', label: 'Russian', nativeLabel: 'Русский' },
];

const selectOptions: SelectOption[] = LANGUAGE_OPTIONS.map((lang) => ({
  value: lang.value,
  content: `${lang.nativeLabel} (${lang.label})`,
}));

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const handleChange = useCallback(
    (values: string[]) => {
      const selected = values[0] as Language;
      if (selected) {
        onChange(selected);
      }
    },
    [onChange]
  );

  return (
    <Select
      value={[value]}
      onUpdate={handleChange}
      options={selectOptions}
      disabled={disabled}
      width="max"
      size="m"
      placeholder="Select language"
      aria-label="Select interface language"
      data-testid="language-selector"
    />
  );
}
