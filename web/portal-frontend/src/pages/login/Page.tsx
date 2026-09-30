import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@gravity-ui/uikit';
import { redirectToLogin } from '../../modules/portal/auth';
import { sanitizeInternalPath } from '../../shared/lib/tenant';
import { InlineError, useUITranslation } from '../../shared/ui/portal/PortalUI';

export function LoginPage() {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useUITranslation();
  const next = sanitizeInternalPath(params.get('next'), '/choose-tenant');
  const code = params.get('auth_error')?.toUpperCase();
  const requestId = params.get('request_id');
  const message = code === 'INVALID_STATE'
    ? t('Сессия входа истекла или уже была использована. Попробуйте войти снова.', 'This sign-in attempt expired or has already been used. Please try again.')
    : code === 'OAUTH_ERROR'
      ? t('Авторизация в UpdSpaceID была отклонена. Вы можете начать вход снова.', 'Sign-in was cancelled. You can start again.')
      : t('Не удалось завершить вход через UpdSpaceID. Попробуйте ещё раз.', 'Could not complete sign-in with UpdSpaceID. Please try again.');
  return <div className="portal-login"><section className="portal-card">
    <span className="portal-eyebrow">UpdSpaceID</span><h1>{t('Вход в UpdSpace', 'Sign in to UpdSpace')}</h1>
    <p>{t('Один аккаунт для ваших сообществ. Продолжите в UpdSpaceID — после входа вы вернётесь сюда.', 'One account for your communities. Continue with UpdSpaceID and return here after signing in.')}</p>
    {(code || failed) && <InlineError><strong>{t('Не удалось завершить вход', 'Unable to sign in')}</strong><p>{message}</p>{requestId && <details><summary>{t('Сведения для поддержки', 'Support details')}</summary><code>Request ID: {requestId}</code></details>}</InlineError>}
    <div className="portal-actions"><Button view="action" size="l" loading={pending} disabled={pending} onClick={() => {setPending(true); try {redirectToLogin(next);} catch {setFailed(true); setPending(false);}}}>{t('Продолжить с UpdSpaceID', 'Continue with UpdSpaceID')}</Button><Button href="/" size="l" view="flat">{t('На главную', 'Back')}</Button></div>
    <p>{t('Нет аккаунта? Получите приглашение у администратора сообщества.', 'Need an account? Ask your community administrator for an invitation.')}</p>
  </section></div>;
}
