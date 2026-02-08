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
  display_name: string;
  status: string;
  base_role: string;
};

export type ActiveTenant = {
  tenant_id: string;
  tenant_slug: string;
  display_name: string;
  base_role: string;
};

export type SwitchTenantResponse = {
  active_tenant: ActiveTenant;
  redirect_to: string;
};

export type PendingApplication = {
  id: string;
  slug: string;
  status: string;
};

export type EntryMeResponse = {
  user: { id: string; email: string };
  memberships: TenantSummary[];
  last_tenant: { tenant_slug: string } | null;
  pending_tenant_applications: PendingApplication[];
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
  return request<TenantSummary[]>('/session/tenants', { method: 'GET' });
}

/**
 * Tenantless entry point: user info + memberships + last tenant.
 * GET /api/v1/entry/me
 */
export async function fetchEntryMe(): Promise<EntryMeResponse> {
  return request<EntryMeResponse>('/entry/me', { method: 'GET' });
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
