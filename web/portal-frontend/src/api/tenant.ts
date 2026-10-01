/**
 * Tenant API client methods for path-based multi-tenancy.
 *
 * These methods interact with the BFF session/tenant endpoints
 * for switching tenants, listing available tenants, and the
 * tenantless entry flow.
 */
import { request } from './client';

// --- Types ---

export type TenantSummary = {
  tenant_id: string;
  tenant_slug: string;
  display_name?: string | null;
  status: string;
  base_role: string;
};

export type ActiveTenant = {
  tenant_id: string;
  tenant_slug: string;
  display_name?: string | null;
  base_role: string;
};

export type SwitchTenantResponse = {
  active_tenant: ActiveTenant;
  redirect_to: string;
};

export type PendingApplication = {
  id: string;
  name?: string;
  slug: string;
  status: string;
};

export type EntryMeResponse = {
  user: { id: string; email?: string | null };
  memberships: TenantSummary[];
  last_tenant: { tenant_slug: string } | null;
  pending_tenant_applications: PendingApplication[];
  tenant_applications?: PendingApplication[];
};

export type TenantApplicationPayload = {
  slug: string;
  name: string;
  description?: string;
};

// --- API calls ---

/**
 * Switch active tenant in BFF session.
 * POST /api/v1/session/switch-tenant
 */
export async function switchTenant(tenantSlug: string): Promise<SwitchTenantResponse> {
  return request<SwitchTenantResponse>('/session/switch-tenant', {
    method: 'POST',
    body: JSON.stringify({ tenant_slug: tenantSlug }),
  });
}

/**
 * Get list of tenants the user has membership in.
 * GET /api/v1/session/tenants
 */
export async function fetchSessionTenants(): Promise<TenantSummary[]> {
  const result = await request<TenantSummary[]>('/session/tenants', { method: 'GET' });
  if (!Array.isArray(result)) throw new Error('Invalid membership response');
  return result;
}

/**
 * Tenantless entry point: user info + memberships + last tenant.
 * GET /api/v1/entry/me
 */
export async function fetchEntryMe(): Promise<EntryMeResponse> {
  const result = await request<EntryMeResponse>('/entry/me', { method: 'GET' });
  if (!Array.isArray(result?.memberships)) throw new Error('Invalid community response');
  return result;
}

/**
 * Submit a tenant creation application.
 * POST /api/v1/entry/tenant-applications
 */
export async function submitTenantApplication(
  payload: TenantApplicationPayload,
): Promise<unknown> {
  return request('/entry/tenant-applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type ReviewableTenantApplication = PendingApplication & {
  tenant_id: string;
  applicant_user_id: string;
  name: string;
  description: string;
};

export function fetchTenantApplicationsForReview(): Promise<ReviewableTenantApplication[]> {
  return request('/entry/admin/tenant-applications', { method: 'GET' });
}

export function reviewTenantApplication(
  id: string,
  decision: 'approve' | 'reject',
): Promise<ReviewableTenantApplication> {
  return request(`/entry/admin/tenant-applications/${encodeURIComponent(id)}/${decision}`, { method: 'POST' });
}
