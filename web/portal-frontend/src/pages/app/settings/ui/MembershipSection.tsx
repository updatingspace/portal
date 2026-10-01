import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@gravity-ui/uikit';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchSessionTenants, leaveTenant } from '../../../../api/tenant';
import { isApiError } from '../../../../api/client';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTenantContext } from '../../../../contexts/TenantContext';
import {
  InlineError,
  useUITranslation,
} from '../../../../shared/ui/portal/PortalUI';

export function MembershipSection() {
  const t = useUITranslation();
  const { user, setUser } = useAuth();
  const {
    activeTenant,
    availableTenants,
    setActiveTenant,
    setAvailableTenants,
    setState,
  } = useTenantContext();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerBlocked, setOwnerBlocked] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!user || !activeTenant) return null;
  const tenant =
    availableTenants.find(
      (item) => item.tenant_id === activeTenant.tenant_id,
    ) || activeTenant;
  const name = tenant.display_name || tenant.tenant_slug;
  const owner = ownerBlocked || tenant.base_role === 'owner';
  const close = () => {
    if (!submitting.current) setOpen(false);
  };
  const finish = () => {
    if (!mounted.current) return;
    // Drop private data before rendering the account-only shell.
    void client.cancelQueries();
    client.clear();
    setAvailableTenants(
      availableTenants.filter((item) => item.tenant_id !== tenant.tenant_id),
    );
    setActiveTenant(null);
    setState('idle');
    setUser({
      ...user,
      tenant: undefined,
      capabilities: [],
      roles: [],
      featureFlags: {},
      availableTenants: user.availableTenants?.filter(
        (item) => item.id !== tenant.tenant_id,
      ),
    });
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('portal-community');
      channel.postMessage({ leftTenantId: tenant.tenant_id });
      channel.close();
    }
    navigate('/choose-tenant', { replace: true });
  };
  const leave = async () => {
    if (submitting.current || owner) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await leaveTenant(tenant.tenant_id);
      finish();
    } catch (cause) {
      if (isApiError(cause) && cause.code === 'OWNER_CANNOT_LEAVE') {
        setOwnerBlocked(true);
      } else {
        // A lost response is not a failed write: reconcile before offering retry.
        try {
          const memberships = await fetchSessionTenants();
          if (
            !memberships.some((item) => item.tenant_id === tenant.tenant_id)
          ) {
            finish();
            return;
          }
        } catch {
          /* Keep the current context until the result is known. */
        }
        setError(
          t(
            'Не удалось подтвердить выход. Попробуйте ещё раз.',
            'Unable to confirm leaving. Try again.',
          ),
        );
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <section
      className="portal-settings__membership"
      aria-label={t('Участие в сообществе', 'Community membership')}
    >
      <span className="portal-settings__membership-name">{name}</span>
      <Button
        size="l"
        view="flat-secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t('Покинуть…', 'Leave…')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        disableEscapeKeyDown={pending}
        disableOutsideClick={pending}
        aria-label={t(`Покинуть «${name}»?`, `Leave ${name}?`)}
      >
        <Dialog.Header caption={t(`Покинуть «${name}»?`, `Leave ${name}?`)} />
        <Dialog.Body>
          <p className="portal-settings__leave-description">
            {owner
              ? t(
                  'Вы владелец этого сообщества. Выход для владельца пока недоступен: сообщество должно сохранить ответственного владельца.',
                  'You own this community. Leaving as an owner is not available yet: the community must retain its owner.',
                )
              : t(
                  'Доступ к сообществу закроется на всех устройствах. Аккаунт и ваши публикации сохранятся. Для возвращения понадобится помощь администратора.',
                  'You will lose access to this community on all devices. Your account and posts will remain. To return, contact a community administrator.',
                )}
          </p>
          {error && <InlineError>{error}</InlineError>}
        </Dialog.Body>
        <Dialog.Footer>
          <div className="portal-actions">
            <Button size="l" disabled={pending} onClick={close}>
              {owner ? t('Понятно', 'Got it') : t('Отмена', 'Cancel')}
            </Button>
            {!owner && (
              <Button
                size="l"
                view="outlined-danger"
                loading={pending}
                disabled={pending}
                onClick={() => void leave()}
              >
                {t('Покинуть сообщество', 'Leave community')}
              </Button>
            )}
          </div>
        </Dialog.Footer>
      </Dialog>
    </section>
  );
}
