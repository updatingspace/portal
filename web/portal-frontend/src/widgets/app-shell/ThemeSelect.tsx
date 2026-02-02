import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { useThemeMode } from '../../app/providers/ThemeModeProvider';

export const ThemeSelect: React.FC = () => {
  const { mode, setMode } = useThemeMode();
  const options: Array<{ id: 'light' | 'dark'; label: string }> = [
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
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
