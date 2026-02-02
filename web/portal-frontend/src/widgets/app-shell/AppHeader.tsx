import React from 'react';

import { BrandLink } from './BrandLink';
import { ThemeSelect } from './ThemeSelect';
import { AuthActions } from './AuthActions';

export const AppHeader: React.FC = () => (
  <header className="app-shell__header">
    <BrandLink />
    <div className="app-shell__header-actions">
      <ThemeSelect />
      <AuthActions />
    </div>
  </header>
);
