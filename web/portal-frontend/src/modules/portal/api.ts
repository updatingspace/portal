import { requestResult } from '../../api/client';

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
