import { request } from '../../api/client';

export type ScopeType = 'GLOBAL' | 'TENANT' | 'COMMUNITY' | 'TEAM' | 'SERVICE';

export const SCOPE_TYPES: ScopeType[] = ['GLOBAL', 'TENANT', 'COMMUNITY', 'TEAM', 'SERVICE'];

export type TenantRole = {
  id: number;
  tenant_id: string | null;
  service: string;
  name: string;
  permission_keys: string[];
};

export type TenantBinding = {
  id: number;
  tenant_id: string;
  user_id: string;
  scope_type: ScopeType;
  scope_id: string;
  role_id: number;
  role_name: string;
  role_service: string;
  created_at: string;
};

export type TenantMember = {
  tenant_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  bio?: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantAdminEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  performed_by: string;
  created_at: string;
};

export type PermissionEntry = {
  key: string;
  description: string;
  service: string;
};

export type TenantRoleFormPayload = {
  service: string;
  name: string;
  permission_keys: string[];
};

export type TenantBindingFormPayload = {
  tenant_id: string;
  user_id: string;
  scope_type: ScopeType;
  scope_id: string;
  role_id: number;
};

const buildQueryString = (params?: Record<string, string | number | undefined>): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const listTenantRoles = async (params?: {
  query?: string;
  service?: string;
  limit?: number;
}): Promise<TenantRole[]> => {
  const suffix = buildQueryString({
    query: params?.query,
    service: params?.service,
    limit: params?.limit,
  });
  return request<TenantRole[]>(`/access/admin/roles${suffix}`);
};

export const createTenantRole = async (payload: TenantRoleFormPayload): Promise<TenantRole> =>
  request<TenantRole>('/access/admin/roles', { method: 'POST', body: payload });

export const updateTenantRole = async (
  roleId: number,
  payload: TenantRoleFormPayload,
): Promise<TenantRole> => request<TenantRole>(`/access/admin/roles/${roleId}`, { method: 'PATCH', body: payload });

export const deleteTenantRole = async (roleId: number): Promise<{ ok: true }> =>
  request<{ ok: true }>(`/access/admin/roles/${roleId}`, { method: 'DELETE' });

export const searchRoleBindings = async (params?: {
  q?: string;
  scope_type?: ScopeType;
  scope_id?: string;
  user_id?: string;
  limit?: number;
}): Promise<TenantBinding[]> => {
  const suffix = buildQueryString({
    q: params?.q,
    scope_type: params?.scope_type,
    scope_id: params?.scope_id,
    user_id: params?.user_id,
    limit: params?.limit,
  });
  return request<TenantBinding[]>(`/access/admin/role-bindings/search${suffix}`);
};

export const createRoleBinding = async (payload: TenantBindingFormPayload): Promise<TenantBinding> =>
  request<TenantBinding>('/access/admin/role-bindings', { method: 'POST', body: payload });

export const deleteRoleBinding = async (bindingId: number): Promise<{ ok: true }> =>
  request<{ ok: true }>(`/access/admin/role-bindings/${bindingId}`, { method: 'DELETE' });

export const listTenantAdminEvents = async (limit?: number): Promise<TenantAdminEvent[]> => {
  const suffix = buildQueryString({ limit });
  return request<TenantAdminEvent[]>(`/access/admin/events${suffix}`);
};

export const listTenantMembers = async (params?: {
  query?: string;
  limit?: number;
}): Promise<TenantMember[]> => {
  const suffix = buildQueryString({
    q: params?.query,
    limit: params?.limit,
  });
  return request<TenantMember[]>(`/portal/profiles${suffix}`);
};

export const listPermissionCatalog = async (service?: string): Promise<PermissionEntry[]> => {
  const suffix = buildQueryString({ service });
  return request<PermissionEntry[]>(`/access/permissions${suffix}`);
};
