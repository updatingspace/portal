import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    apiBaseUrl: '/api/v1',
    request: vi.fn(),
    requestResult: vi.fn(),
  };
});

vi.unmock('./api');

import { request, requestResult } from '../api/client';
const { headlessLogin, logout, me, uploadAvatar } = await import('./api');

describe('services/api cookie-auth contract', () => {
  beforeEach(() => {
    document.cookie = 'updspace_csrf=test-csrf-token';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('uses account/me for authenticated profile reads', async () => {
    vi.mocked(requestResult).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        user: {
          username: 'root',
          email: 'root@example.com',
          has_2fa: false,
          oauth_providers: [],
          email_verified: true,
          is_staff: true,
          is_superuser: true,
        },
      },
      headers: new Headers(),
      durationMs: 1,
    });

    const profile = await me();

    expect(profile?.username).toBe('root');
    expect(requestResult).toHaveBeenCalledWith('/account/me', {
      skipAuthClear: true,
    });
  });

  it('does not expose legacy token from headless login responses', async () => {
    vi.mocked(requestResult).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        user: {
          username: 'root',
          email: 'root@example.com',
          has_2fa: false,
          oauth_providers: [],
          email_verified: true,
          is_staff: false,
          is_superuser: false,
        },
        session_token: 'legacy-token',
      },
      headers: new Headers({ 'X-Session-Token': 'legacy-token' }),
      durationMs: 1,
    });

    const result = await headlessLogin('root@example.com', 'secret123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result).not.toHaveProperty('token');
      expect(result.meta).not.toHaveProperty('session_token');
    }
  });

  it('uploads avatar through shared account request flow', async () => {
    vi.mocked(request).mockResolvedValue({
      ok: true,
      avatar_url: '/media/avatar.png',
    });

    await uploadAvatar(new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    expect(request).toHaveBeenCalledWith(
      '/account/avatar',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
  });

  it('logs out through BFF session endpoint', async () => {
    vi.mocked(request).mockResolvedValue(undefined);

    await logout();

    expect(request).toHaveBeenCalledWith('/logout', { method: 'POST' });
  });
});
