import { useEffect, useState } from 'react';
import { Button } from '@gravity-ui/uikit';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { PageState, useUITranslation } from '../../shared/ui/portal/PortalUI';

type Gate = {slug: string; phase: 'loading' | 'ready' | 'forbidden' | 'error'; message?: string};
export function TenantGate() {
  const {tenantSlug = ''} = useParams();
  const {user, refreshProfile} = useAuth();
  const {switchTenant} = useTenantContext();
  const navigate = useNavigate();
  const t = useUITranslation();
  const userId = user?.id;
  const [attempt, setAttempt] = useState(0);
  const [gate, setGate] = useState<Gate>({slug: tenantSlug, phase: 'loading'});
  useEffect(() => {
    if (!tenantSlug || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await switchTenant(tenantSlug);
        if (cancelled) return;
        if (!result.ok) {
          if (result.reason === 'unauthenticated') {
            navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`, {replace: true});
            return;
          }
          setGate({slug: tenantSlug, phase: result.reason === 'forbidden' ? 'forbidden' : 'error', message: result.message});
          return;
        }
        const profile = await refreshProfile();
        if (cancelled) return;
        if (!profile || profile.tenant?.slug !== tenantSlug) {
          setGate({slug: tenantSlug, phase: 'error', message: 'Не удалось подтвердить сообщество и права. Повторите загрузку.'});
          return;
        }
        setGate({slug: tenantSlug, phase: 'ready'});
      } catch {
        if (!cancelled) setGate({slug: tenantSlug, phase: 'error'});
      }
    })();
    return () => {cancelled = true;};
  }, [tenantSlug, userId, attempt, switchTenant, refreshProfile, navigate]);
  if (!tenantSlug) return <Navigate to="/choose-tenant" replace />;
  if (gate.phase === 'ready' && gate.slug === tenantSlug && user?.tenant?.slug === tenantSlug) return <Outlet />;
  if (gate.phase === 'loading' || gate.slug !== tenantSlug) return <PageState kind="loading" title={t('Открываем сообщество', 'Opening community')} description={t('Проверяем доступ и загружаем ваши права.', 'Checking membership and permissions.')} />;
  return <PageState kind={gate.phase === 'forbidden' ? 'forbidden' : 'error'} title={gate.phase === 'forbidden' ? t('Нет доступа', 'Access unavailable') : t('Не удалось открыть сообщество', 'Unable to open community')} description={gate.message ?? t('Попробуйте ещё раз или выберите другое сообщество.', 'Try again or choose another community.')} action={gate.phase !== 'forbidden' && <Button onClick={() => {setGate({slug: tenantSlug, phase: 'loading'}); setAttempt((n) => n + 1);}}>{t('Повторить', 'Try again')}</Button>} secondaryAction={<Button onClick={() => navigate('/choose-tenant')}>{t('Мои сообщества', 'My communities')}</Button>} />;
}
