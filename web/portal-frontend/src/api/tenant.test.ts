/**
 * Tenant API client — unit tests.
 *
 * Tests each exported function:
 * - switchTenant(): POST /session/switch-tenant
 * - fetchSessionTenants(): GET /session/tenants
 * - fetchEntryMe(): GET /entry/me
 * - submitTenantApplication(): POST /entry/tenant-applications
 *
 * All tests mock the `request` function from `./client`.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import {
  switchTenant,
  fetchSessionTenants,
  fetchEntryMe,
  submitTenantApplication,
} from './tenant';

// Mock the request function
vi.mock('./client', () => ({
  request: vi.fn(),
}));

import { request } from './client';
const requestMock = request as Mock;

describe('tenant API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // switchTenant
  // ----------------------------------------------------------------

  describe('switchTenant', () => {
    it('calls POST /session/switch-tenant with slug', async () => {
      const response = {
        active_tenant: { tenant_id: 't1', tenant_slug: 'aef', display_name: 'AEF', base_role: 'owner' },
        redirect_to: '/t/aef/',
      };
      requestMock.mockResolvedValueOnce(response);

      const result = await switchTenant('aef');

      expect(requestMock).toHaveBeenCalledWith('/session/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenant_slug: 'aef' }),
      });
      expect(result).toEqual(response);
    });

    it('propagates errors from request', async () => {
      requestMock.mockRejectedValueOnce(new Error('Network fail'));

      await expect(switchTenant('aef')).rejects.toThrow('Network fail');
    });
  });

  // ----------------------------------------------------------------
  // fetchSessionTenants
  // ----------------------------------------------------------------

  describe('fetchSessionTenants', () => {
    it('calls GET /session/tenants', async () => {
      const tenants = [
        { tenant_id: 't1', tenant_slug: 'aef', display_name: 'AEF', status: 'active', base_role: 'owner' },
      ];
      requestMock.mockResolvedValueOnce(tenants);

      const result = await fetchSessionTenants();

      expect(requestMock).toHaveBeenCalledWith('/session/tenants', { method: 'GET' });
      expect(result).toEqual(tenants);
    });

    it('returns empty array from API', async () => {
      requestMock.mockResolvedValueOnce([]);

      const result = await fetchSessionTenants();
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // fetchEntryMe
  // ----------------------------------------------------------------

  describe('fetchEntryMe', () => {
    it('calls GET /entry/me', async () => {
      const data = {
        user: { id: 'u1', email: 'test@test.com' },
        memberships: [],
        last_tenant: null,
        pending_tenant_applications: [],
      };
      requestMock.mockResolvedValueOnce(data);

      const result = await fetchEntryMe();

      expect(requestMock).toHaveBeenCalledWith('/entry/me', { method: 'GET' });
      expect(result).toEqual(data);
    });
  });

  // ----------------------------------------------------------------
  // submitTenantApplication
  // ----------------------------------------------------------------

  describe('submitTenantApplication', () => {
    it('calls POST /entry/tenant-applications with payload', async () => {
      requestMock.mockResolvedValueOnce({ ok: true });

      const payload = { slug: 'my-community', name: 'My Community', description: 'A community' };
      await submitTenantApplication(payload);

      expect(requestMock).toHaveBeenCalledWith('/entry/tenant-applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    });

    it('submits without description', async () => {
      requestMock.mockResolvedValueOnce({ ok: true });

      const payload = { slug: 'slug-only', name: 'Slug Only' };
      await submitTenantApplication(payload);

      expect(requestMock).toHaveBeenCalledWith('/entry/tenant-applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    });
  });
});
