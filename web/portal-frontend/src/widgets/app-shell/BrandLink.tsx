import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, type SelectOption } from '@gravity-ui/uikit';

import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';

export const BrandLink: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const label = user?.tenant?.slug ? `AEF · ${user.tenant.slug}` : 'AEF Portal';

  const availableTenants = user?.availableTenants ?? [];
  const canSwitch = availableTenants.length > 1;

  const switchOptions: SelectOption[] = availableTenants.map((tenant) => ({
    value: tenant.slug,
    content: tenant.slug,
  }));

  const currentTenantSlug = user?.tenant?.slug;

  const handleSwitchTenant = (values: string[]) => {
    const nextSlug = values[0];
    if (!nextSlug || !currentTenantSlug || nextSlug === currentTenantSlug) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const host = window.location.host;
    const hostParts = host.split('.');
    if (hostParts.length < 3) {
      logger.warn('Unable to switch tenant: unexpected host format', {
        area: 'auth',
        event: 'tenant_switch_invalid_host',
        data: { host, nextSlug },
      });
      return;
    }

    hostParts[0] = nextSlug;
    const nextHost = hostParts.join('.');
    const nextUrl = `${window.location.protocol}//${nextHost}/app`;
    window.location.assign(nextUrl);
  };

  return (
    <div className="app-shell__brand-wrap">
      <button type="button" className="app-shell__brand" onClick={() => navigate('/app')}>
        {label}
      </button>
      {canSwitch ? (
        <Select
          data-testid="brand-tenant-switch"
          className="app-shell__tenant-switch"
          value={currentTenantSlug ? [currentTenantSlug] : []}
          options={switchOptions}
          onUpdate={handleSwitchTenant}
          size="s"
          width="max"
        />
      ) : null}
    </div>
  );
};
