import React, { useMemo, useState } from 'react';
import { AsideHeader } from '@gravity-ui/navigation';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  type AccessDeniedError,
  subscribeAccessDenied,
} from '../../api/accessDenied';
import { buildAsideMenuItems } from '../../features/navigation/menu';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { AccessDeniedScreen } from '../../features/access-denied';
import { TenantSwitcher } from '../../components/TenantSwitcher';
import { AppHeader } from './AppHeader';
import './app-shell.css';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const { activeTenant, availableTenants } = useTenantContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [isAsideCompact, setIsAsideCompact] = useState(false);
  const [accessDeniedError, setAccessDeniedError] = useState<AccessDeniedError | null>(null);

  // Determine route base: /t/<slug> or legacy /app
  const routeBase = tenantSlug ? `/t/${tenantSlug}` : '/app';

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
        routeBase,
      }),
    [location.pathname, navigate, user, routeBase],
  );

  const logoText = activeTenant?.tenant_slug
    ? `${activeTenant.tenant_slug.toUpperCase()} · Portal`
    : user?.tenant?.slug
      ? `${user.tenant.slug.toUpperCase()} · Portal`
      : 'UpdSpace Portal';

  return (
    <div className="app-shell">
      <AsideHeader
        className="app-shell__aside"
        compact={isAsideCompact}
        onChangeCompact={setIsAsideCompact}
        logo={{
          text: logoText,
          onClick: () => navigate(routeBase),
        }}
        menuItems={menuItems}
        renderContent={() => (
          <div className="app-shell__content-shell">
            <AppHeader showBrand={false} tenantSwitcher={
              availableTenants.length > 1
                ? <TenantSwitcher />
                : undefined
            } />
            <main className="app-shell__content">
              {accessDeniedError ? <AccessDeniedScreen error={accessDeniedError} /> : <Outlet />}
            </main>
          </div>
        )}
      />
    </div>
  );
};
