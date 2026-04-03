import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMfaStatus,
  fetchPasskeys,
  fetchProfile,
  fetchSessions,
  revokeSession,
  updateProfile,
} from './account';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('account api wrappers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches profile and sessions', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ id: 'u1', email: 'u@x.dev' })
      .mockResolvedValueOnce([{ id: 's1', ip: null }]);

    await expect(fetchProfile()).resolves.toMatchObject({ id: 'u1' });
    await expect(fetchSessions()).resolves.toHaveLength(1);

    expect(request).toHaveBeenNthCalledWith(1, '/account/profile');
    expect(request).toHaveBeenNthCalledWith(2, '/account/sessions');
  });

  it('updates profile and calls revoke/mfa/passkeys endpoints', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ id: 'u1', display_name: 'Neo' })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ totp_enabled: true, webauthn_enabled: false, recovery_codes_available: 1, authenticators: [] })
      .mockResolvedValueOnce([{ id: 'k1', name: 'Mac', type: 'webauthn', created_at: 1, last_used_at: null, is_passwordless: true }]);

    await updateProfile({ display_name: 'Neo' });
    await revokeSession('s1');
    await fetchMfaStatus();
    await fetchPasskeys();

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/account/profile',
      expect.objectContaining({ method: 'PATCH', body: { display_name: 'Neo' } }),
    );
    expect(request).toHaveBeenNthCalledWith(2, '/account/sessions/s1', { method: 'DELETE' });
    expect(request).toHaveBeenNthCalledWith(3, '/account/mfa/status');
    expect(request).toHaveBeenNthCalledWith(4, '/account/passkeys');
  });
});
