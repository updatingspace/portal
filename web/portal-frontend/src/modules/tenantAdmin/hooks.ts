import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  listPermissionCatalog,
  listTenantAdminEvents,
  listTenantMembers,
  listTenantRoles,
  searchRoleBindings,
  type ScopeType,
} from './api';

function useAdminQuery<T>(
  key: unknown[],
  queryFn: () => Promise<T>,
  enabled = true,
) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['community-management', user?.tenant?.id, user?.id, ...key],
    queryFn,
    enabled: enabled && Boolean(user?.tenant?.id),
    retry: false,
  });
  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    reload: query.refetch,
  };
}
export function useTenantRoles(
  params: { query?: string; service?: string; limit?: number } = {},
) {
  const query = useAdminQuery(['roles', params], () => listTenantRoles(params));
  return { ...query, roles: query.data ?? [] };
}
export function useRoleBindings(
  params: {
    q?: string;
    scopeType?: ScopeType;
    scopeId?: string;
    userId?: string;
    limit?: number;
    enabled?: boolean;
  } = {},
) {
  const { q, scopeType, scopeId, userId, limit = 50, enabled = true } = params;
  const query = useAdminQuery(
    ['bindings', q, scopeType, scopeId, userId, limit],
    () =>
      searchRoleBindings({
        q,
        scope_type: scopeType,
        scope_id: scopeId,
        user_id: userId,
        limit,
      }),
    enabled,
  );
  return { ...query, bindings: query.data ?? [] };
}
export function useTenantAdminEvents(limit = 20) {
  const query = useAdminQuery(['audit', limit], () =>
    listTenantAdminEvents(limit),
  );
  return { ...query, events: query.data ?? [] };
}
export function useTenantMembers(
  params: { query?: string; limit?: number } = {},
) {
  const query = useAdminQuery(['members', params], () =>
    listTenantMembers(params),
  );
  return { ...query, members: query.data ?? [] };
}
export function usePermissionCatalog(service?: string) {
  const query = useAdminQuery(['permissions', service], () =>
    listPermissionCatalog(service),
  );
  return { ...query, permissions: query.data ?? [] };
}
