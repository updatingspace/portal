import React, { useMemo, useState } from 'react';
import { AsideHeader } from '@gravity-ui/navigation';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  type AccessDeniedError,
  subscribeAccessDenied,
} from '../../api/accessDenied';
import { buildAsideMenuItems } from '../../features/navigation/menu';
import { useAuth } from '../../contexts/AuthContext';
import { AccessDeniedScreen } from '../../features/access-denied';
import { AppHeader } from './AppHeader';
import './app-shell.css';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAsideCompact, setIsAsideCompact] = useState(false);
  const [accessDeniedError, setAccessDeniedError] = useState<AccessDeniedError | null>(null);

  const routeKey = `${location.pathname}${location.search}`;

  React.useEffect(() => {
    const unsubscribe = subscribeAccessDenied((error) => {
      if (error.path === routeKey) {
        setAccessDeniedError(error);
      }
    });
    return unsubscribe;
  }, [routeKey]);

  React.useEffect(() => {
    if (!accessDeniedError) return;
    if (accessDeniedError.path !== routeKey) {
      setAccessDeniedError(null);
    }
  }, [accessDeniedError, routeKey]);

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
              {accessDeniedError ? <AccessDeniedScreen error={accessDeniedError} /> : <Outlet />}
            </main>
          </div>
        )}
      />
    </div>
  );
};
