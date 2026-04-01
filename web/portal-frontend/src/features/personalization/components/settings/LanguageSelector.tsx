/**
 * LanguageSelector - Language selection dropdown
 */
import { Select, type SelectOption } from '@gravity-ui/uikit';
import { useCallback } from 'react';

import { useI18n } from '@/app/providers/I18nProvider';
import { usePersonalizationI18n } from '../../i18n';
import type { Language } from '../../types';
import './settings.css';

export interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
}

interface LanguageConfig {
  value: Language;
  nativeLabel: string;
}

const LANGUAGE_OPTIONS: LanguageConfig[] = [
  { value: 'en', nativeLabel: 'English' },
  { value: 'ru', nativeLabel: 'Русский' },
];

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const { changeLocale } = useI18n();
  const { t } = usePersonalizationI18n();
  const selectOptions: SelectOption[] = LANGUAGE_OPTIONS.map((lang) => ({
    value: lang.value,
    content: `${lang.nativeLabel} (${lang.value === 'en' ? t('language.en') : t('language.ru')})`,
  }));

  const handleChange = useCallback(
    (values: string[]) => {
      const selected = values[0] as Language;
      if (selected) {
        onChange(selected);
        changeLocale(selected);
      }
    },
    [onChange, changeLocale]
  );

  return (
    <Select
      value={[value]}
      onUpdate={handleChange}
      options={selectOptions}
      disabled={disabled}
      width="max"
      size="m"
      placeholder={t('language.placeholder')}
      aria-label={t('language.aria')}
      data-testid="language-selector"
    />
  );
}
