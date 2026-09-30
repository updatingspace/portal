import { Button, Dialog } from '@gravity-ui/uikit';
import React, { useMemo, useState } from 'react';
import { AsideHeader } from '@gravity-ui/navigation';
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { RouteDocumentTitle } from '../../app/providers/RouteDocumentTitle';
import { useI18n } from '../../app/providers/i18nContext';
import { buildAsideMenuItems } from '../../features/navigation/menu';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { Suspense } from 'react';
import { AppLoader } from '../../shared/ui/AppLoader';
import { PrivateQueryScope } from '../../app/providers/PrivateQueryScope';
import { ContextChangedDialog } from '../../components/ContextChangedDialog';
import { useMediaQuery } from '../../shared/hooks/useMediaQuery';
import { PersonalizationRuntime } from '../../features/personalization/runtime/PersonalizationRuntime';
import { AppHeader } from './AppHeader';
import './app-shell.css';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const { locale } = useI18n();
  const { activeTenant } = useTenantContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [isAsideCompact, setIsAsideCompact] = useState(
    () => window.innerWidth < 1080,
  );
  React.useEffect(() => {
    const update = () => setIsAsideCompact(window.innerWidth < 1080);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const isMobile = useMediaQuery('(max-width: 719px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const routeBase = tenantSlug ? `/t/${tenantSlug}` : '/app';

  const menuItems = useMemo(
    () =>
      buildAsideMenuItems({
        user,
        locale,
        currentPath: location.pathname,
        onNavigate: (to) => navigate(to),
        routeBase,
      }),
    [location.pathname, navigate, user, routeBase, locale],
  );

  const logoText = activeTenant?.tenant_slug
    ? `${activeTenant.tenant_slug.toUpperCase()} · Portal`
    : user?.tenant?.slug
      ? `${user.tenant.slug.toUpperCase()} · Portal`
      : 'UpdSpace Portal';

  const content = (
    <div className="app-shell__content-shell">
      <PersonalizationRuntime />
      <AppHeader
        showBrand={isMobile}
        leading={
          isMobile ? (
            <Button
              size="xl"
              view="flat"
              aria-label={
                locale === 'ru' ? 'Открыть меню разделов' : 'Open navigation'
              }
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          ) : undefined
        }
      />
      <main className="app-shell__content" id="main-content" tabIndex={-1}>
        <Suspense fallback={<AppLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
  return (
    <PrivateQueryScope>
      <div className={`app-shell${isMobile ? ' app-shell--mobile' : ''}`}>
        <a className="portal-skip" href="#main-content">
          {locale === 'ru' ? 'К содержимому' : 'Skip to content'}
        </a>
        <ContextChangedDialog />
        <RouteDocumentTitle />
        {/* Keep the route subtree mounted when the viewport crosses a breakpoint. */}
        <AsideHeader
          className="app-shell__aside"
          compact={isAsideCompact}
          onChangeCompact={setIsAsideCompact}
          logo={{ text: logoText, onClick: () => navigate(routeBase) }}
          menuItems={menuItems}
          renderContent={() => content}
        />
        {isMobile && menuOpen && (
          <Dialog
            open
            onClose={() => setMenuOpen(false)}
            aria-label={locale === 'ru' ? 'Разделы' : 'Navigation'}
            size="s"
            className="portal-navigation-dialog"
          >
            <Dialog.Header
              caption={locale === 'ru' ? 'Разделы' : 'Navigation'}
            />
            <Dialog.Body>
              <nav
                className="portal-navigation-menu"
                aria-label={
                  locale === 'ru' ? 'Основные разделы' : 'Main navigation'
                }
              >
                {menuItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={String(item.link)}
                    end={item.id === 'dashboard'}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.title}
                  </NavLink>
                ))}
              </nav>
            </Dialog.Body>
          </Dialog>
        )}
      </div>
    </PrivateQueryScope>
  );
};
