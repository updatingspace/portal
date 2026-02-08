import { ApiError, request, requestResult } from '../../api/client';

export type SessionMe = {
  user: { id: string; master_flags?: Record<string, unknown> | null };
  tenant: { id: string; slug: string };
  portal_profile?: Record<string, unknown> | null;
  id_profile?: Record<string, unknown> | null;
  tenant_membership?: Record<string, unknown> | null;
  id_frontend_base_url?: string | null;
  request_id?: string;
};

export type SessionMeResult = {
  data: SessionMe | null;
  unauthorized: boolean;
  tenantNotSelected: boolean;
};

export async function fetchSessionMeResult(): Promise<SessionMeResult> {
  const res = await requestResult<SessionMe>('/session/me', { method: 'GET' });
  if (res.ok) {
    return { data: res.data, unauthorized: false, tenantNotSelected: false };
  }

  if (res.status === 401) {
    return { data: null, unauthorized: true, tenantNotSelected: false };
  }

  if (res.status === 403 && res.error.code === 'TENANT_NOT_SELECTED') {
    return { data: null, unauthorized: false, tenantNotSelected: true };
  }

  throw new ApiError(res.error.message ?? 'Failed to load /session/me', {
    status: res.status,
    kind: res.status >= 500 ? 'server' : res.status === 404 ? 'not_found' : 'unknown',
    details: res.error.details,
    code: res.error.code,
  });
}

export async function fetchSessionMe(): Promise<SessionMe | null> {
  const result = await fetchSessionMeResult();
  return result.data;
}

export type PortalProfile = {
  tenantId: string;
  userId: string;
  username?: string | null;
  displayName?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalCommunity = {
  id: string;
  name: string;
  description?: string | null;
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
  avatar_url?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

type RawPortalCommunity = {
  id?: string;
  name?: string;
  description?: string | null;
};

const mapPortalProfile = (raw: RawPortalProfile): PortalProfile => ({
  tenantId: raw.tenantId ?? raw.tenant_id ?? '',
  userId: raw.userId ?? raw.user_id ?? '',
  username: raw.username ?? null,
  displayName: raw.displayName ?? raw.display_name ?? null,
  firstName: raw.firstName ?? raw.first_name ?? '',
  lastName: raw.lastName ?? raw.last_name ?? '',
  avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
  bio: raw.bio ?? null,
  createdAt: raw.createdAt ?? raw.created_at ?? '',
  updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
});

const mapPortalCommunity = (raw: RawPortalCommunity): PortalCommunity => ({
  id: raw.id ?? '',
  name: raw.name ?? '',
  description: raw.description ?? null,
});

export async function fetchPortalProfiles(params?: {
  q?: string;
  limit?: number;
}): Promise<PortalProfile[]> {
  const suffix = buildQueryString({ q: params?.q, limit: params?.limit });
  const data = await request<RawPortalProfile[]>(`/portal/profiles${suffix}`);
  return data.map(mapPortalProfile);
}

export async function fetchPortalCommunities(): Promise<PortalCommunity[]> {
  const data = await request<RawPortalCommunity[]>('/portal/communities');
  return data.map(mapPortalCommunity);
}
