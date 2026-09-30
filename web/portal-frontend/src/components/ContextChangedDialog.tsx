import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenantContext } from '../contexts/TenantContext';
import { ConfirmDialog, useUITranslation } from '../shared/ui/portal/PortalUI';
export function ContextChangedDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {user, refreshProfile} = useAuth();
  const {switchTenant} = useTenantContext();
  const t = useUITranslation();
  useEffect(() => {const show = () => setOpen(true); window.addEventListener('portal:context-changed', show); return () => window.removeEventListener('portal:context-changed', show);}, []);
  return <ConfirmDialog open={open} title={t('Сообщество изменилось в другой вкладке', 'Community changed in another tab')} description={t('Изменение не отправлено в другое сообщество. Восстановите контекст этой вкладки и проверьте данные перед повтором действия.', 'The action was not sent to another community. Restore this tab’s context and review the data before trying again.')} confirmLabel={t('Восстановить контекст', 'Restore context')} pending={pending} error={error} onClose={() => setOpen(false)} onConfirm={() => {void (async () => {if (!user?.tenant?.slug) return; setPending(true); setError(null); try {const result = await switchTenant(user.tenant.slug); if (!result.ok) throw new Error(result.message); const profile = await refreshProfile(); if (profile?.tenant?.slug !== user.tenant.slug) throw new Error(t('Не удалось подтвердить доступ.', 'Unable to verify access.')); setOpen(false);} catch {setError(t('Не удалось восстановить контекст. Повторите попытку.', 'Unable to restore context. Try again.'));} finally {setPending(false);}})();}} />;
}
