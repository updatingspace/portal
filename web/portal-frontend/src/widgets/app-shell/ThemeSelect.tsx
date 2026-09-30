import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { useUITranslation } from '../../shared/ui/portal/PortalUI';
import { useThemeMode } from '../../app/providers/themeModeContext';

export const ThemeSelect: React.FC = () => {
  const t = useUITranslation();
  const { mode, resolvedMode, setMode } = useThemeMode();
  const options: Array<{ id: 'light' | 'dark' | 'auto'; label: string }> = [
    { id: 'auto', label: t('Авто', 'Auto') },
    { id: 'light', label: t('Светлая', 'Light') },
    { id: 'dark', label: t('Тёмная', 'Dark') },
  ];

  return (
    <div className="app-shell__theme-select" aria-label={t('Тема', 'Theme')} data-testid="app-theme-select">
      {options.map((option) => (
        <Button
          key={option.id}
          size="s"
          view={mode === option.id ? 'action' : 'flat'}
          onClick={() => setMode(option.id)}
          title={option.id === 'auto' ? `System (${resolvedMode})` : undefined}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
