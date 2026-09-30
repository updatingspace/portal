import { Select, Button } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import { useTenantContext } from '../contexts/TenantContext';
import { useUITranslation } from '../shared/ui/portal/PortalUI';

export function TenantSwitcher() {
  const {activeTenant, availableTenants} = useTenantContext();
  const navigate = useNavigate();
  const t = useUITranslation();
  return <div className="portal-actions">
    <Select id="community-switcher" aria-label={t('Текущее сообщество', 'Current community')} filterable={availableTenants.length > 5} value={activeTenant ? [activeTenant.tenant_slug] : []} placeholder={t('Сообщество', 'Community')} options={availableTenants.map((tenant) => ({value: tenant.tenant_slug, content: tenant.display_name || tenant.tenant_slug, disabled: tenant.status !== 'active'}))} onUpdate={([slug]) => {if (slug && slug !== activeTenant?.tenant_slug) navigate(`/t/${slug}/`);}} />
    <Button view="flat" onClick={() => navigate('/choose-tenant')}>{t('Все сообщества', 'All communities')}</Button>
  </div>;
}
