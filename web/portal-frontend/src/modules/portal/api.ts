import { request, requestResult } from '../../api/client';

export type SessionMe = {
  user: { id: string; master_flags?: Record<string, unknown> | null };
  tenant: { id: string; slug: string };
  portal_profile?: Record<string, unknown> | null;
  id_profile?: Record<string, unknown> | null;
  tenant_membership?: Record<string, unknown> | null;
  id_frontend_base_url?: string | null;
  request_id?: string;
};

export async function fetchSessionMe(): Promise<SessionMe | null> {
  const res = await requestResult<SessionMe>('/session/me', { method: 'GET' });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(res.error.message ?? 'Failed to load /session/me');
  }
  return res.data;
}

export type PortalProfile = {
  tenantId: string;
  userId: string;
  username?: string | null;
  displayName?: string | null;
  firstName: string;
  lastName: string;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
};

const buildQueryString = (params?: Record<string, string | number | undefined>): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

type RawPortalProfile = {
  tenant_id?: string;
  tenantId?: string;
  user_id?: string;
  userId?: string;
  username?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  bio?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

const mapPortalProfile = (raw: RawPortalProfile): PortalProfile => ({
  tenantId: raw.tenantId ?? raw.tenant_id ?? '',
  userId: raw.userId ?? raw.user_id ?? '',
  username: raw.username ?? null,
  displayName: raw.displayName ?? raw.display_name ?? null,
  firstName: raw.firstName ?? raw.first_name ?? '',
  lastName: raw.lastName ?? raw.last_name ?? '',
  bio: raw.bio ?? null,
  createdAt: raw.createdAt ?? raw.created_at ?? '',
  updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
});

export async function fetchPortalProfiles(params?: {
  q?: string;
  limit?: number;
}): Promise<PortalProfile[]> {
  const suffix = buildQueryString({ q: params?.q, limit: params?.limit });
  const data = await request<RawPortalProfile[]>(`/portal/profiles${suffix}`);
  return data.map(mapPortalProfile);
}
