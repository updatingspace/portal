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
import { fetchSessionMe } from '../modules/portal/api';

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
  availableTenants?: Array<{ id: string; slug: string }>;
  capabilities?: string[];
  roles?: string[];
  featureFlags?: Record<string, boolean>;
  language?: string | null;
  idTheme?: 'light' | 'dark' | 'auto' | null;
};

export type SessionIssue = {
  code: string;
  message: string;
};

const boolFromUnknown = (value: unknown): boolean => value === true || value === 'true' || value === 1;

const safeString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const deriveUserFromSessionMe = (payload: unknown): UserInfo | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as {
    user?: { id?: unknown; master_flags?: unknown };
    tenant?: { id?: unknown; slug?: unknown };
    available_tenants?: unknown;
    portal_profile?: Record<string, unknown> | null;
    id_profile?: { user?: Record<string, unknown> | null } | null;
    id_defaults?: { theme?: unknown } | null;
    capabilities?: unknown;
    roles?: unknown;
    feature_flags?: unknown;
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
  const idThemeRaw =
    data.id_defaults && typeof data.id_defaults === 'object'
      ? safeString((data.id_defaults as { theme?: unknown }).theme)
      : null;
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

  const tenantId = safeString(data.tenant?.id);
  const tenantSlug = safeString(data.tenant?.slug);

  const availableTenants = Array.isArray(data.available_tenants)
    ? data.available_tenants
        .filter(
          (item): item is { id: string; slug: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { id?: unknown }).id === 'string' &&
            typeof (item as { slug?: unknown }).slug === 'string',
        )
        .map((item) => ({ id: item.id.trim(), slug: item.slug.trim() }))
        .filter((item) => item.id.length > 0 && item.slug.length > 0)
    : undefined;

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
    availableTenants,
    capabilities,
    roles,
    featureFlags,
    language,
    idTheme: idThemeRaw === 'light' || idThemeRaw === 'dark' || idThemeRaw === 'auto' ? idThemeRaw : null,
  };
};

type AuthContextValue = {
  user: UserInfo | null;
  isLoading: boolean;
  isInitialized: boolean;
  sessionIssue: SessionIssue | null;
  refreshProfile: () => Promise<UserInfo | null>;
  setUser: (nextUser: UserInfo | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; bootstrap?: boolean }> = ({
  children,
  bootstrap = true,
}) => {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [sessionIssue, setSessionIssue] = useState<SessionIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Start as not initialized in all modes; tests and runtime will
  // explicitly mark initialization complete via setUser/refreshProfile.
  const [isInitialized, setIsInitialized] = useState(false);
  const refreshInFlightRef = useRef<Promise<UserInfo | null> | null>(null);

  const setUser = useCallback((nextUser: UserInfo | null) => {
    setUserState(nextUser);
    setSessionIssue(null);
    setIsInitialized(true);
  }, []);

  const getCurrentSubdomain = (): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    const hostParts = window.location.host.split('.');
    if (hostParts.length < 3) {
      return null;
    }
    const subdomain = hostParts[0]?.trim();
    return subdomain && subdomain.length > 0 ? subdomain : null;
  };

  const extractAvailableTenantsFromDetails = (
    details: unknown,
  ): Array<{ id: string; slug: string }> => {
    if (!details || typeof details !== 'object') {
      return [];
    }
    const raw = (details as { available_tenants?: unknown }).available_tenants;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter(
        (item): item is { id: string; slug: string } =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as { id?: unknown }).id === 'string' &&
          typeof (item as { slug?: unknown }).slug === 'string',
      )
      .map((item) => ({ id: item.id.trim(), slug: item.slug.trim() }))
      .filter((item) => item.id.length > 0 && item.slug.length > 0);
  };

  const tryRedirectToAvailableTenant = (
    tenants: Array<{ id: string; slug: string }>,
  ): boolean => {
    if (typeof window === 'undefined' || tenants.length === 0) {
      return false;
    }

    const currentSubdomain = getCurrentSubdomain();
    const candidate = tenants.find(
      (tenant) => tenant.slug !== currentSubdomain,
    );
    if (!candidate) {
      return false;
    }

    const hostParts = window.location.host.split('.');
    if (hostParts.length < 3) {
      return false;
    }
    hostParts[0] = candidate.slug;

    const nextHost = hostParts.join('.');
    const nextUrl = `${window.location.protocol}//${nextHost}/app`;
    window.location.assign(nextUrl);
    return true;
  };

  const refreshProfile = useCallback((): Promise<UserInfo | null> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = (async (): Promise<UserInfo | null> => {
      setIsLoading(true);
      logger.info('Refreshing profile', {
        area: 'auth',
        event: 'refresh_profile',
      });

      try {
        const session = await fetchSessionMe();
        if (session) {
          setSessionIssue(null);
          const mapped = deriveUserFromSessionMe(session);
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
        setUser(null);
        logger.info('Profile refresh: guest state', {
          area: 'auth',
          event: 'refresh_profile',
        });
        return null;
      } catch (error) {
        if (isApiError(error)) {
          // Treat 401 and tenant-not-found as guest state (no toast)
          const isTenantNotFound =
            error.code === 'TENANT_NOT_FOUND' ||
            (error.message && error.message.toLowerCase().includes('unknown tenant'));
          const isNoActiveMembership = error.code === 'NO_ACTIVE_MEMBERSHIP';
          if (error.kind === 'unauthorized' || isTenantNotFound) {
            setUser(null);
            setSessionIssue(null);
            logger.warn('Profile refresh guest state', {
              area: 'auth',
              event: 'refresh_profile',
              data: { reason: error.kind === 'unauthorized' ? 'unauthorized' : 'tenant_not_found' },
              error,
            });
          } else if (isNoActiveMembership) {
            const availableTenants = extractAvailableTenantsFromDetails(error.details);
            const redirected = tryRedirectToAvailableTenant(availableTenants);
            setUserState(null);
            setSessionIssue({
              code: 'NO_ACTIVE_MEMBERSHIP',
              message:
                error.message ||
                'В текущем tenant нет активного membership. Выберите другой tenant или обратитесь к администратору.',
            });
            logger.warn('Profile refresh blocked: no active membership', {
              area: 'auth',
              event: 'refresh_profile',
              data: {
                reason: 'no_active_membership',
                redirected,
                availableTenantsCount: availableTenants.length,
              },
              error,
            });
          } else {
            setSessionIssue(null);
            notifyApiError(error, 'Не получилось обновить профиль');
          }
        } else {
          setSessionIssue(null);
          notifyApiError(error, 'Не получилось обновить профиль');
        }
        return null;
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [setUser]);

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
      sessionIssue,
      refreshProfile,
      setUser,
    }),
    [isInitialized, isLoading, refreshProfile, sessionIssue, setUser, user],
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
