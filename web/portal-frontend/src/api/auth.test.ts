import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authWithTelegram,
  deleteAccount,
  fetchProfile,
  loginUser,
  logoutUser,
  registerUser,
  revokeOtherSessions,
  revokeSession,
} from './auth';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('auth api mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps register/login telegram responses from snake_case to camelCase', async () => {
    const apiPayload = {
      user: {
        id: 7,
        username: 'neo',
        email: 'neo@matrix.dev',
        telegram_id: 42,
        telegram_username: 'chosen',
        telegram_linked: true,
        is_staff: true,
        is_superuser: false,
      },
      session: {
        session_key: 's-key',
        is_current: true,
        ip_address: '127.0.0.1',
        user_agent: 'UA',
        created_at: '2026-01-01',
        last_seen_at: '2026-01-02',
        expires_at: '2026-02-01',
      },
    };

    vi.mocked(request)
      .mockResolvedValueOnce(apiPayload)
      .mockResolvedValueOnce(apiPayload)
      .mockResolvedValueOnce(apiPayload);

    const registered = await registerUser({
      username: 'neo',
      email: 'neo@matrix.dev',
      password: 'secret',
      passwordConfirm: 'secret',
    });
    const logged = await loginUser({ login: 'neo', password: 'secret' });
    const telegram = await authWithTelegram({ id: 1, firstName: 'Neo', authDate: 123, hash: 'h' });

    expect(registered.user.telegramLinked).toBe(true);
    expect(logged.session.sessionKey).toBe('s-key');
    expect(telegram.user.telegramUsername).toBe('chosen');
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/auth/register',
      expect.objectContaining({ body: expect.objectContaining({ password_confirm: 'secret' }) }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/auth/telegram',
      expect.objectContaining({ body: expect.objectContaining({ first_name: 'Neo', auth_date: 123 }) }),
    );
  });

  it('maps profile and sends session/account mutation endpoints', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        user: { id: 1, username: 'u', telegramLinked: false },
        sessions: [{ session_key: 's1', is_current: false, expires_at: 'x' }],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const profile = await fetchProfile();
    await revokeSession('s1');
    await revokeOtherSessions();
    await logoutUser();
    await deleteAccount();

    expect(profile.sessions[0].sessionKey).toBe('s1');
    expect(request).toHaveBeenNthCalledWith(2, '/auth/sessions/s1', { method: 'DELETE' });
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/auth/sessions/bulk',
      expect.objectContaining({ method: 'POST', body: { all_except_current: true, reason: 'bulk_except_current' } }),
    );
    expect(request).toHaveBeenNthCalledWith(4, '/auth/logout', { method: 'POST' });
    expect(request).toHaveBeenNthCalledWith(5, '/account/me', { method: 'DELETE' });
  });
});
