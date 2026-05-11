import React from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { BrandLink } from './BrandLink';
import { ThemeSelect } from './ThemeSelect';
import { AuthActions } from './AuthActions';

export const DEVELOPER_HEADER_THEME_FLAG = 'developer_theme_toggle_enabled';

type AppHeaderProps = {
  showBrand?: boolean;
  tenantSwitcher?: React.ReactNode;
};

export const AppHeader: React.FC<AppHeaderProps> = ({ showBrand = true, tenantSwitcher }) => {
  const { user } = useAuth();
  const showDeveloperThemeSelect = Boolean(
    user?.isSuperuser && user.featureFlags?.[DEVELOPER_HEADER_THEME_FLAG] === true,
  );

  return (
    <header className={`app-shell__header${showBrand ? '' : ' app-shell__header--no-brand'}`}>
      {showBrand ? <BrandLink /> : null}
      <div className="app-shell__header-actions">
        {tenantSwitcher}
        {showDeveloperThemeSelect ? <ThemeSelect /> : null}
        <AuthActions />
      </div>
    </header>
  );
};
