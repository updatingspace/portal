import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { useThemeMode } from '../../app/providers/ThemeModeProvider';

export const ThemeSelect: React.FC = () => {
  const { mode, resolvedMode, setMode } = useThemeMode();
  const options: Array<{ id: 'light' | 'dark' | 'system'; label: string }> = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  return (
    <div className="app-shell__theme-select" aria-label="Theme">
      {options.map((option) => (
        <Button
          key={option.id}
          size="s"
          view={mode === option.id ? 'action' : 'flat'}
          onClick={() => setMode(option.id)}
          title={option.id === 'system' ? `System (${resolvedMode})` : undefined}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
