import React from 'react';
import { Button } from '@gravity-ui/uikit';

import { useThemeMode } from '../../app/providers/themeModeContext';

export const ThemeSelect: React.FC = () => {
  const { mode, resolvedMode, setMode } = useThemeMode();
  const options: Array<{ id: 'light' | 'dark' | 'auto'; label: string }> = [
    { id: 'auto', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  return (
    <div className="app-shell__theme-select" aria-label="Theme" data-testid="app-theme-select">
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
