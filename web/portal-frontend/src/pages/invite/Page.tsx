import { Button } from '@gravity-ui/uikit';
import { PageState, useUITranslation } from '../../shared/ui/portal/PortalUI';
export function InvitePage() {
  const t = useUITranslation();
  // There is no /invite/activate contract in this BFF. Never submit a token to an invented endpoint.
  return <div className="portal-page"><PageState kind="unavailable" title={t('Приглашение в UpdSpace', 'Your UpdSpace invitation')} description={t('Активация этой ссылки в портале пока недоступна. Попросите администратора сообщества прислать ссылку активации UpdSpaceID. Если аккаунт уже активирован, войдите и проверьте доступные сообщества.', 'Activation through this portal link is not yet available. Ask your community administrator for an UpdSpaceID activation link. If your account is already active, sign in to view your communities.')} action={<Button view="action" href="/login">{t('Войти', 'Sign in')}</Button>} secondaryAction={<Button href="/">{t('На главную', 'Home')}</Button>} /></div>;
}
