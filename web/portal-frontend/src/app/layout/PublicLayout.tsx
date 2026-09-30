import React, { Suspense } from 'react';
import { ThemeSelect } from '../../widgets/app-shell/ThemeSelect';
import { AppLoader } from '../../shared/ui/AppLoader';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';

import { RouteDocumentTitle } from '../providers/RouteDocumentTitle';
import { useI18n } from '../providers/i18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { env } from '../../shared/config/env';
import {
  getPortalHostForTenantAlias,
  getTenantAliasFromHost,
  getTenantAppRootPath,
  getTenantFromHost,
} from '@/shared/lib/tenant';
import { usePortalI18n } from '@/shared/i18n/usePortalI18n';

export const PublicLayout: React.FC = () => {
  const { user } = useAuth();
  const { locale: currentLocale, changeLocale } = useI18n();
  const { t } = usePortalI18n();
  const navigate = useNavigate();

  const tenantAlias = typeof window !== 'undefined'
    ? getTenantAliasFromHost(window.location.host)
    : null;
  const tenantFromHost = typeof window !== 'undefined'
    ? getTenantFromHost(window.location.host, env.tenantHint)
    : null;
  const tenantSlug = user?.tenant?.slug ?? tenantFromHost?.slug ?? '';

  const langItems: DropdownMenuItem[] = [
    { text: 'English', action: () => changeLocale('en') },
    { text: 'Русский', action: () => changeLocale('ru') },
  ];

  const navigateToCanonicalPortal = (path: string) => {
    if (typeof window === 'undefined' || !tenantAlias) {
      navigate(path);
      return;
    }

    const portalHost = getPortalHostForTenantAlias(window.location.host);
    if (!portalHost) {
      navigate(path);
      return;
    }

    const targetUrl = new URL(path, `${window.location.protocol}//${portalHost}`);
    window.location.assign(targetUrl.toString());
  };

  return (
    <div className="public-root">
      <RouteDocumentTitle />
      <header className="public-header">
        <div className="container d-flex align-items-center justify-content-between py-3">
          <NavLink to="/" className="logo-link" aria-label="UpdatingSpace Portal">
            <div className="logo-box">UpdSpace{tenantSlug ? ` · ${tenantSlug}` : ''}</div>
          </NavLink>

          <div className="d-flex align-items-center gap-2">
            <ThemeSelect />
            <DropdownMenu
              items={langItems}
              renderSwitcher={(props) => (
                <Button {...props} view="flat" aria-label={t('public.language')}>
                  {currentLocale.toUpperCase()}
                </Button>
              )}
            />
            {user ? (
              <Button
                view="action"
                onClick={() => {
                  if (tenantAlias) {
                    navigateToCanonicalPortal(getTenantAppRootPath(tenantAlias.slug));
                    return;
                  }
                  navigate('/choose-tenant');
                }}
              >
                {t('public.goToApp')}
              </Button>
            ) : (
              <Button
                view="outlined"
                onClick={() => {
                  if (tenantAlias) {
                    navigateToCanonicalPortal(`/login?next=${encodeURIComponent(getTenantAppRootPath(tenantAlias.slug))}`);
                    return;
                  }
                  navigate('/login');
                }}
              >
                {t('public.login')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Suspense fallback={<AppLoader />}><Outlet /></Suspense>
      </main>

      <footer className="public-footer" id="contacts">
        <div className="container py-4 d-flex flex-column flex-md-row justify-content-between gap-3">
          <div>
            <div className="fw-semibold">UpdSpace Portal</div>
            <div className="text-muted small">{t('public.portalDescription')}</div>
          </div>
          <div className="text-muted small">{t('public.support')}: <a href="https://t.me/m4tveevm">@m4tveevm</a></div>
        </div>
      </footer>
    </div>
  );
};
