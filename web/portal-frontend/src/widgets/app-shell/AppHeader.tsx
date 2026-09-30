import React from 'react';

import { BrandLink } from './BrandLink';
import { ThemeSelect } from './ThemeSelect';
import { AuthActions } from './AuthActions';

export const DEVELOPER_HEADER_THEME_FLAG = 'developer_theme_toggle_enabled';

type AppHeaderProps = {
  showBrand?: boolean;
  leading?: React.ReactNode;
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  showBrand = true,
  leading,
}) => {
  return (
    <header
      className={`app-shell__header${showBrand ? '' : ' app-shell__header--no-brand'}`}
    >
      <div className="app-shell__header-leading">
        {leading}
        {showBrand ? <BrandLink /> : null}
      </div>
      <div className="app-shell__header-actions">
        <ThemeSelect />
        <AuthActions />
      </div>
    </header>
  );
};
