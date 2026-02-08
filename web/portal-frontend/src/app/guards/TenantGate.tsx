/**
 * TenantGate — wrapper for /t/:tenantSlug/* routes.
 *
 * On mount, calls switch-tenant for the slug from URL params,
 * then fetches session/me to hydrate auth context.
 * Handles loading / switching / forbidden / error states.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { AppLoader } from '../../shared/ui/AppLoader';

type GateState = 'idle' | 'switching' | 'ready' | 'forbidden' | 'error';

export const TenantGate: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { activeTenant, doSwitchTenant, setState: setTenantState } = useTenantContext();
  const [gateState, setGateState] = useState<GateState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const switchingRef = useRef(false);
  const lastSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      navigate('/choose-tenant', { replace: true });
      return;
    }

    if (!user) {
      // Not yet authenticated — let RequireSession handle redirect
      return;
    }

    // Already switched to this tenant (either locally or via TenantContext)
    if (activeTenant?.tenant_slug === tenantSlug && gateState === 'ready') {
      return;
    }

    // If TenantContext already has the correct active tenant (e.g. TenantChooserPage
    // already called doSwitchTenant), skip the redundant API call.
    if (activeTenant?.tenant_slug === tenantSlug && gateState === 'idle') {
      lastSlugRef.current = tenantSlug;
      setGateState('ready');
      setTenantState('ready');
      // Still refresh profile to hydrate user capabilities for this tenant
      Promise.resolve(refreshProfile()).catch(() => {
        // Non-critical — capabilities will be fetched on first use
      });
      return;
    }

    // Terminal state for this slug — don't retry until slug changes
    if (
      (gateState === 'ready' || gateState === 'forbidden' || gateState === 'error') &&
      lastSlugRef.current === tenantSlug
    ) {
      return;
    }

    // Prevent concurrent switches
    if (switchingRef.current && lastSlugRef.current === tenantSlug) {
      return;
    }

    const doSwitch = async () => {
      switchingRef.current = true;
      lastSlugRef.current = tenantSlug;
      setGateState('switching');
      setErrorMsg(null);

      try {
        const success = await doSwitchTenant(tenantSlug);
        if (!success) {
          setGateState('forbidden');
          return;
        }

        // Refresh auth context to get updated session/me
        await refreshProfile();
        setGateState('ready');
        setTenantState('ready');
      } catch (err: unknown) {
        const apiErr = err as { code?: string; message?: string };
        if (apiErr.code === 'TENANT_FORBIDDEN') {
          setGateState('forbidden');
          setErrorMsg(apiErr.message ?? 'Access denied');
        } else if (apiErr.code === 'UNAUTHENTICATED') {
          navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
        } else {
          setGateState('error');
          setErrorMsg(apiErr.message ?? 'Failed to switch tenant');
        }
      } finally {
        switchingRef.current = false;
      }
    };

    doSwitch();
  }, [tenantSlug, user, activeTenant, gateState, doSwitchTenant, refreshProfile, navigate, setTenantState]);

  if (gateState === 'switching' || gateState === 'idle') {
    return <AppLoader />;
  }

  if (gateState === 'forbidden') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: 480, margin: '4rem auto' }}>
        <h2>Нет доступа</h2>
        <p>{errorMsg || 'У вас нет доступа к этому tenant.'}</p>
        <button
          onClick={() => navigate('/choose-tenant?reason=forbidden', { replace: true })}
          style={{
            padding: '0.5rem 1.5rem',
            cursor: 'pointer',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: '#f0f0f0',
          }}
        >
          Выбрать другой tenant
        </button>
      </div>
    );
  }

  if (gateState === 'error') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: 480, margin: '4rem auto' }}>
        <h2>Ошибка</h2>
        <p>{errorMsg || 'Произошла ошибка при переключении tenant.'}</p>
        <button
          onClick={() => navigate('/choose-tenant', { replace: true })}
          style={{
            padding: '0.5rem 1.5rem',
            cursor: 'pointer',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: '#f0f0f0',
          }}
        >
          Выбрать tenant
        </button>
      </div>
    );
  }

  return <Outlet />;
};
