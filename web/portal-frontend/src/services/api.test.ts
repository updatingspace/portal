import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    request: vi.fn(),
    requestResult: vi.fn(),
  };
});

import { request, requestResult } from '../api/client';

const requestMock = request as unknown as Mock;
const requestResultMock = requestResult as unknown as Mock;

const mockSuccessfulLoginResponse = () => {
  requestResultMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      access_token: 'secret-access-token',
      session_token: 'legacy-session-token',
      meta: { session_token: 'meta-session-token' },
      user: {
        username: 'alice',
        email: 'alice@example.com',
        has_2fa: false,
        oauth_providers: [],
        email_verified: true,
        is_staff: false,
        is_superuser: false,
      },
    },
    headers: new Headers({ 'X-Session-Token': 'header-session-token' }),
    durationMs: 1,
  });
};

const performLogin = async (api: typeof import('./api')) =>
  api.doLogin({
    email: 'alice@example.com',
    password: 'super-secret',
  });

describe('services/api cookie auth flow', () => {
  let api: typeof import('./api');

  beforeAll(async () => {
    api = await vi.importActual<typeof import('./api')>('./api');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('does not expose token field in login result', async () => {
    mockSuccessfulLoginResponse();

    const result = await performLogin(api);

    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty('token');
  });

  it('does not persist session token to localStorage after login', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    mockSuccessfulLoginResponse();

    await performLogin(api);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('aef_session_token')).toBeNull();
  });

  it('uploads avatar via the shared cookie-auth request path', async () => {
    requestMock.mockResolvedValue({
      ok: true,
      avatar_url: 'https://example.com/avatar.png',
      avatar_source: 'upload',
      avatar_gravatar_enabled: false,
    });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await api.uploadAvatar(file);

    expect(requestMock).toHaveBeenCalledWith(
      '/auth/avatar',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const [, options] = requestMock.mock.calls[0];
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).get('avatar')).toBe(file);
  });

  it('deletes avatar via the shared cookie-auth request path', async () => {
    requestMock.mockResolvedValue({ ok: true });

    await api.deleteAvatar();

    expect(requestMock).toHaveBeenCalledWith('/auth/avatar', { method: 'DELETE' });
  });
});
