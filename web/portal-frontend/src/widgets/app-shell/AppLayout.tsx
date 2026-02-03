import React, { useMemo, useState } from 'react';
import { AsideHeader } from '@gravity-ui/navigation';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { buildAsideMenuItems } from '../../features/navigation/menu';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from './AppHeader';
import './app-shell.css';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAsideCompact, setIsAsideCompact] = useState(false);

  const menuItems = useMemo(
    () =>
      buildAsideMenuItems({
        user,
        currentPath: location.pathname,
        onNavigate: (to) => navigate(to),
      }),
    [location.pathname, navigate, user],
  );

  return (
    <div className="app-shell">
      <AsideHeader
        className="app-shell__aside"
        compact={isAsideCompact}
        onChangeCompact={setIsAsideCompact}
        logo={{
          text: user?.tenant?.slug ? `AEF · ${user.tenant.slug}` : 'AEF Portal',
          onClick: () => navigate('/app'),
        }}
        menuItems={menuItems}
        renderContent={() => (
          <div className="app-shell__content-shell">
            <AppHeader showBrand={false} />
            <main className="app-shell__content">
              <Outlet />
            </main>
          </div>
        )}
      />
    </div>
  );
};
