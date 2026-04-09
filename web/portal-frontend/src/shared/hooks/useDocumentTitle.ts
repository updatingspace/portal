import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { getTenantAliasFromHost } from '../lib/tenant';
import { buildDocumentTitle } from '../lib/documentTitle';

export const useDocumentTitle = (pageTitle?: string | null) => {
  const { tenantSlug: routeTenantSlug } = useParams<{ tenantSlug?: string }>();
  const { user } = useAuth();
  const { activeTenant } = useTenantContext();

  const tenantSlug = useMemo(() => {
    if (routeTenantSlug?.trim()) {
      return routeTenantSlug.trim();
    }

    if (activeTenant?.tenant_slug?.trim()) {
      return activeTenant.tenant_slug.trim();
    }

    if (user?.tenant?.slug?.trim()) {
      return user.tenant.slug.trim();
    }

    if (typeof window === 'undefined') {
      return null;
    }

    return getTenantAliasFromHost(window.location.host)?.slug ?? null;
  }, [activeTenant?.tenant_slug, routeTenantSlug, user?.tenant?.slug]);

  const title = useMemo(
    () => buildDocumentTitle({ pageTitle, tenantSlug }),
    [pageTitle, tenantSlug],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.title = title;
  }, [title]);

  return title;
};
