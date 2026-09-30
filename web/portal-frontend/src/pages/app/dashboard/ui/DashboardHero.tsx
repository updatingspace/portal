import { useTenantContext } from '../../../../contexts/TenantContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useUITranslation } from '../../../../shared/ui/portal/PortalUI';
export function DashboardHero() {
  const { user } = useAuth();
  const { availableTenants: tenants } = useTenantContext();
  const t = useUITranslation();
  return (
    <div className="dashboard-community">
      <span className="dashboard-community__mark" aria-hidden="true">
        {(
          tenants.find((item) => item.tenant_slug === user?.tenant?.slug)
            ?.display_name ||
          user?.tenant?.slug ||
          'U'
        )
          .slice(0, 1)
          .toUpperCase()}
      </span>
      <div>
        <h2>
          {tenants.find((item) => item.tenant_slug === user?.tenant?.slug)
            ?.display_name ||
            user?.tenant?.slug ||
            'UpdSpace'}
        </h2>
        <p>{t('Ваше сообщество', 'Your community')}</p>
      </div>
    </div>
  );
}
