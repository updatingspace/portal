import React from 'react';

import { BrandLink } from './BrandLink';
import { ThemeSelect } from './ThemeSelect';
import { AuthActions } from './AuthActions';

type AppHeaderProps = {
  showBrand?: boolean;
  tenantSwitcher?: React.ReactNode;
};

export const AppHeader: React.FC<AppHeaderProps> = ({ showBrand = true, tenantSwitcher }) => (
  <header className={`app-shell__header${showBrand ? '' : ' app-shell__header--no-brand'}`}>
    {showBrand ? <BrandLink /> : null}
    <div className="app-shell__header-actions">
      {tenantSwitcher}
      <ThemeSelect />
      <AuthActions />
    </div>
  </header>
);
