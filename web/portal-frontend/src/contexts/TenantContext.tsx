/**
 * TenantContext: manages active tenant state for path-based multi-tenancy.
 *
 * Provides:
 * - useTenant() — current active tenant
 * - useAvailableTenants() — list of user's tenants
 * - useSwitchTenant() — switch active tenant
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  type ActiveTenant,
  type TenantSummary,
  fetchSessionTenants,
  switchTenant as apiSwitchTenant,
} from '../api/tenant';
import { logger } from '../utils/logger';

// --- Types ---

export type TenantState =
  | 'idle'
  | 'loading'
  | 'switching'
  | 'ready'
  | 'forbidden'
  | 'no-memberships'
  | 'error';

type TenantContextValue = {
  /** Current active tenant (null when tenantless). */
  activeTenant: ActiveTenant | null;
  /** All tenants the user has membership in. */
  availableTenants: TenantSummary[];
  /** Current state of the tenant subsystem. */
  state: TenantState;
  /** Error message if state is 'error' or 'forbidden'. */
  errorMessage: string | null;
  /** Switch to a different tenant by slug. */
  doSwitchTenant: (slug: string) => Promise<boolean>;
  /** Refresh the available tenants list. */
  refreshTenants: () => Promise<TenantSummary[]>;
  /** Set active tenant info directly (e.g. after session/me). */
  setActiveTenant: (tenant: ActiveTenant | null) => void;
  /** Set available tenants directly. */
  setAvailableTenants: (tenants: TenantSummary[]) => void;
  /** Set state. */
  setState: (state: TenantState) => void;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

// --- Provider ---

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTenant, setActiveTenant] = useState<ActiveTenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantSummary[]>([]);
  const [state, setState] = useState<TenantState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshTenants = useCallback(async (): Promise<TenantSummary[]> => {
    try {
      const tenants = await fetchSessionTenants();
      setAvailableTenants(tenants);
      return tenants;
    } catch (err) {
      logger.error('Failed to refresh tenants', { error: err });
      return [];
    }
  }, []);

  const doSwitchTenant = useCallback(
    async (slug: string): Promise<boolean> => {
      setState('switching');
      setErrorMessage(null);

      try {
        const result = await apiSwitchTenant(slug);
        setActiveTenant(result.active_tenant);
        setState('ready');
        logger.info('Tenant switched', {
          area: 'tenant',
          event: 'switch',
          data: { slug, tenant_id: result.active_tenant.tenant_id },
        });
        return true;
      } catch (err: unknown) {
        const apiErr = err as { code?: string; status?: number; message?: string };
        if (apiErr.code === 'TENANT_FORBIDDEN' || apiErr.status === 403) {
          setState('forbidden');
          setErrorMessage(apiErr.message ?? 'Access denied to this tenant');
        } else {
          setState('error');
          setErrorMessage(apiErr.message ?? 'Failed to switch tenant');
        }
        logger.error('Tenant switch failed', {
          area: 'tenant',
          event: 'switch_error',
          error: err,
        });
        return false;
      }
    },
    [],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      activeTenant,
      availableTenants,
      state,
      errorMessage,
      doSwitchTenant,
      refreshTenants,
      setActiveTenant,
      setAvailableTenants,
      setState,
    }),
    [activeTenant, availableTenants, state, errorMessage, doSwitchTenant, refreshTenants],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

// --- Hooks ---

/** Access the full TenantContext. */
// eslint-disable-next-line react-refresh/only-export-components
export const useTenantContext = (): TenantContextValue => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return ctx;
};

/** Get the current active tenant (null if tenantless). */
// eslint-disable-next-line react-refresh/only-export-components
export const useTenant = (): ActiveTenant | null => {
  return useTenantContext().activeTenant;
};

/** Get the list of available tenants. */
// eslint-disable-next-line react-refresh/only-export-components
export const useAvailableTenants = (): TenantSummary[] => {
  return useTenantContext().availableTenants;
};
