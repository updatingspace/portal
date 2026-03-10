import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isApiError } from '../api/client';
import { notifyApiError } from '../utils/apiErrorHandling';
import { logger } from '../utils/logger';
import { fetchEntryMe } from '../api/tenant';
import { fetchSessionMeResult } from '../modules/portal/api';

export type UserInfo = {
  id: string;
  username: string;
  email: string | null;
  avatarUrl?: string | null;
  isSuperuser: boolean;
  isStaff: boolean;
  displayName: string;
  masterFlags?: Record<string, unknown> | null;
  tenant?: { id: string; slug: string };
  capabilities?: string[];
  roles?: string[];
  featureFlags?: Record<string, boolean>;
  experiments?: Record<string, string>;
  language?: string | null;
};

const boolFromUnknown = (value: unknown): boolean => value === true || value === 'true' || value === 1;

const safeString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const deriveUserFromSessionMe = (payload: unknown): UserInfo | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as {
    user?: { id?: unknown; master_flags?: unknown };
    tenant?: { id?: unknown; slug?: unknown };
    active_tenant?: { tenant_id?: unknown; tenant_slug?: unknown };
    available_tenants?: unknown[];
    portal_profile?: Record<string, unknown> | null;
    id_profile?: { user?: Record<string, unknown> | null } | null;
    capabilities?: unknown;
    roles?: unknown;
    feature_flags?: unknown;
    experiments?: unknown;
  };

  const userId = safeString(data.user?.id);
  if (!userId) return null;

  const masterFlags =
    data.user?.master_flags && typeof data.user.master_flags === 'object'
      ? (data.user.master_flags as Record<string, unknown>)
      : null;
  const isSuperuser = boolFromUnknown(masterFlags?.system_admin);

  const portalProfile =
    data.portal_profile && typeof data.portal_profile === 'object'
      ? (data.portal_profile as Record<string, unknown>)
      : null;
  const idProfileUser =
    data.id_profile && typeof data.id_profile === 'object' && data.id_profile?.user && typeof data.id_profile.user === 'object'
      ? (data.id_profile.user as Record<string, unknown>)
      : null;

  const username =
    safeString(idProfileUser?.username) ??
    safeString(portalProfile?.username) ??
    userId;
  const language = safeString(portalProfile?.language) ?? safeString(portalProfile?.lang) ?? safeString(portalProfile?.locale);
  const email = safeString(portalProfile?.email) ?? safeString(idProfileUser?.email);
  const avatarUrl =
    safeString(portalProfile?.avatar_url) ??
    safeString(portalProfile?.avatarUrl) ??
    safeString(idProfileUser?.avatar_url) ??
    safeString(idProfileUser?.avatarUrl);
  const firstName =
    safeString(portalProfile?.first_name) ??
    safeString(portalProfile?.firstName) ??
    safeString(idProfileUser?.first_name) ??
    safeString(idProfileUser?.firstName);
  const lastName =
    safeString(portalProfile?.last_name) ??
    safeString(portalProfile?.lastName) ??
    safeString(idProfileUser?.last_name) ??
    safeString(idProfileUser?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const displayName =
    (fullName.length ? fullName : null) ??
    safeString(portalProfile?.display_name) ??
    safeString(portalProfile?.displayName) ??
    safeString(idProfileUser?.display_name) ??
    safeString(idProfileUser?.displayName) ??
    username;

  const tenantId = safeString(data.active_tenant?.tenant_id) ?? safeString(data.tenant?.id);
  const tenantSlug = safeString(data.active_tenant?.tenant_slug) ?? safeString(data.tenant?.slug);

  const capabilities = Array.isArray(data.capabilities)
    ? data.capabilities
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        .map((c) => c.trim())
    : undefined;

  const roles = Array.isArray(data.roles)
    ? data.roles
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => r.trim())
    : undefined;

  const featureFlags =
    data.feature_flags && typeof data.feature_flags === 'object'
      ? Object.fromEntries(
          Object.entries(data.feature_flags as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'boolean')
            .map(([k, v]) => [k, v as boolean]),
        )
      : undefined;

  const experiments =
    data.experiments && typeof data.experiments === 'object'
      ? Object.fromEntries(
          Object.entries(data.experiments as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, v as string]),
        )
      : undefined;

  return {
    id: userId,
    username,
    email,
    avatarUrl,
    isSuperuser,
    isStaff: false,
    displayName,
    masterFlags,
    tenant: tenantId && tenantSlug ? { id: tenantId, slug: tenantSlug } : undefined,
    capabilities,
    roles,
    featureFlags,
    experiments,
    language,
  };
};

const deriveUserFromEntryMe = (payload: unknown): UserInfo | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { user?: { id?: unknown; email?: unknown } };
  const userId = safeString(data.user?.id);
  if (!userId) return null;
  const email = safeString(data.user?.email);
  return {
    id: userId,
    username: userId,
    email,
    isSuperuser: false,
    isStaff: false,
    displayName: userId,
  };
};

type AuthContextValue = {
  user: UserInfo | null;
  isLoading: boolean;
  isInitialized: boolean;
  refreshProfile: () => Promise<UserInfo | null>;
  setUser: (nextUser: UserInfo | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; bootstrap?: boolean }> = ({
  children,
  bootstrap = true,
}) => {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Start as not initialized in all modes; tests and runtime will
  // explicitly mark initialization complete via setUser/refreshProfile.
  const [isInitialized, setIsInitialized] = useState(false);
  const refreshInFlightRef = useRef<Promise<UserInfo | null> | null>(null);
  const lastRefreshAtRef = useRef<number>(0);

  const setUser = useCallback((nextUser: UserInfo | null) => {
    setUserState(nextUser);
    setIsInitialized(true);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const now = Date.now();
    if (now - lastRefreshAtRef.current < 1000) {
      return user;
    }

    const refreshPromise = (async () => {
      setIsLoading(true);
      logger.info('Refreshing profile', {
        area: 'auth',
        event: 'refresh_profile',
      });

      try {
        const sessionResult = await fetchSessionMeResult();
      if (sessionResult.data) {
        const mapped = deriveUserFromSessionMe(sessionResult.data);
        setUser(mapped);
        logger.info('Profile refreshed', {
          area: 'auth',
          event: 'refresh_profile',
          data: {
            userId: mapped?.id,
            tenant: mapped?.tenant?.slug,
            isAdmin: mapped?.isSuperuser,
          },
        });
        return mapped;
      }

      if (sessionResult.tenantNotSelected) {
        try {
          const entry = await fetchEntryMe();
          const mapped = deriveUserFromEntryMe(entry);
          setUser(mapped);
          logger.info('Profile refresh: tenantless session', {
            area: 'auth',
            event: 'refresh_profile',
            data: { userId: mapped?.id },
          });
          return mapped;
        } catch (entryError) {
          logger.warn('Profile refresh: failed entry/me during tenantless session', {
            area: 'auth',
            event: 'refresh_profile',
            error: entryError,
          });
        }
      }

      if (sessionResult.unauthorized) {
        setUser(null);
        logger.info('Profile refresh: guest state', {
          area: 'auth',
          event: 'refresh_profile',
        });
        return null;
      }

      setUser(null);
      logger.info('Profile refresh: tenantless or unknown state', {
        area: 'auth',
        event: 'refresh_profile',
      });
      return null;
    } catch (error) {
      if (isApiError(error)) {
        if (error.status === 429) {
          logger.warn('Profile refresh rate limited', {
            area: 'auth',
            event: 'refresh_profile',
            data: { status: error.status },
            error,
          });
          return user;
        }
        // Treat 401 and tenant-not-found as guest state (no toast)
        const isTenantNotFound =
          error.code === 'TENANT_NOT_FOUND' ||
          (error.message && error.message.toLowerCase().includes('unknown tenant'));
        if (error.kind === 'unauthorized' || isTenantNotFound) {
          setUser(null);
          logger.warn('Profile refresh guest state', {
            area: 'auth',
            event: 'refresh_profile',
            data: { reason: error.kind === 'unauthorized' ? 'unauthorized' : 'tenant_not_found' },
            error,
          });
        } else {
          notifyApiError(error, 'Не получилось обновить профиль');
        }
      } else {
        notifyApiError(error, 'Не получилось обновить профиль');
      }
      return null;
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
      lastRefreshAtRef.current = Date.now();
      refreshInFlightRef.current = null;
    }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [setUser, user]);

  useEffect(() => {
    if (bootstrap && !isInitialized) {
      refreshProfile();
    }
  }, [bootstrap, isInitialized, refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isInitialized,
      refreshProfile,
      setUser,
    }),
    [isInitialized, isLoading, refreshProfile, setUser, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
