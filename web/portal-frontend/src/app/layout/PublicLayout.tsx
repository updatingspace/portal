import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, DropdownMenu, type DropdownMenuItem } from '@gravity-ui/uikit';

import { useAuth } from '../../contexts/AuthContext';
import { env } from '../../shared/config/env';
import { getTenantFromHost } from '../../shared/lib/tenant';
import { getLocale, setLocale, type Locale } from '../../shared/lib/locale';

export const PublicLayout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const tenantFromHost = typeof window !== 'undefined'
    ? getTenantFromHost(window.location.host, env.tenantHint)
    : null;
  const tenantSlug = user?.tenant?.slug ?? tenantFromHost?.slug ?? 'aef';

  const langItems: DropdownMenuItem[] = [
    { text: 'English', action: () => setLocale('en') },
    { text: 'Русский', action: () => setLocale('ru') },
  ];
  const currentLocale: Locale = getLocale();

  return (
    <div className="public-root">
      <header className="public-header">
        <div className="container d-flex align-items-center justify-content-between py-3">
          <NavLink to="/" className="logo-link" aria-label="UpdatingSpace Portal">
            <div className="logo-box">UpdSpace · {tenantSlug}</div>
          </NavLink>

          <div className="d-flex align-items-center gap-2">
            <DropdownMenu
              items={langItems}
              renderSwitcher={(props) => (
                <Button {...props} view="flat" aria-label="Language">
                  {currentLocale.toUpperCase()}
                </Button>
              )}
            />
            {user ? (
              <Button view="action" onClick={() => navigate('/app')}>Go to App</Button>
            ) : (
              <Button view="outlined" onClick={() => navigate('/login')}>Login</Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="public-footer" id="contacts">
        <div className="container py-4 d-flex flex-column flex-md-row justify-content-between gap-3">
          <div>
            <div className="fw-semibold">AEF Portal</div>
            <div className="text-muted small">Многотенантный портал для игровых сообществ.</div>
          </div>
          <div className="text-muted small">Поддержка: <a href="https://t.me/m4tveevm">@m4tveevm</a> (не забывайте указать Request ID при обращении)</div>
        </div>
      </footer>
    </div>
  );
};
