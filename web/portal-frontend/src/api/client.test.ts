import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedError } from './accessDenied';
import { request, requestResult } from './client';

global.fetch = vi.fn();

describe('requestResult business handling', () => {
  afterEach(() => {
    vi.resetAllMocks();
    document.cookie = 'updspace_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('bootstraps csrf before unsafe requests when the cookie is missing', async () => {
    (fetch as unknown as vi.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'bootstrap-token' }),
        clone() {
          return this;
        },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        clone() {
          return this;
        },
        headers: new Headers(),
      });

    const res = await requestResult('/test', { method: 'POST' });

    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/csrf',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'bootstrap-token',
        }),
      }),
    );
  });

  it('uses the existing csrf cookie without an extra bootstrap request', async () => {
    document.cookie = 'updspace_csrf=cookie-token; path=/';
    (fetch as unknown as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    const res = await requestResult('/test', { method: 'POST' });

    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'cookie-token',
        }),
      }),
    );
  });

  it('treats 429 with known code as business error', async () => {
    (fetch as unknown as vi.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ code: 'LOGIN_RATE_LIMITED', retry_after_seconds: 10 }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    const res = await requestResult('/test', { method: 'POST' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(429);
      expect(res.error.code).toBe('LOGIN_RATE_LIMITED');
    }
  });

  it('throws AccessDeniedError when request receives 403', async () => {
    (fetch as unknown as vi.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden by Access service',
          request_id: 'req-403',
        },
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    let error: unknown = null;
    try {
      await request('/test/protected');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error).toMatchObject({
      source: 'api',
      requestId: 'req-403',
    });
  });

  it('preserves original route in AccessDeniedError when user navigates before response resolves', async () => {
    let resolveFetch: ((value: unknown) => void) | null = null;
    (fetch as unknown as vi.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    window.history.pushState({}, '', '/app/feed');
    const pending = request('/test/protected');
    window.history.pushState({}, '', '/app/events');

    await Promise.resolve();

    resolveFetch?.({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden by Access service',
          request_id: 'req-403-race',
        },
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    await expect(pending).rejects.toMatchObject({
      requestId: 'req-403-race',
      path: '/app/feed',
    });
  });

  it('preserves FormData bodies and adds CSRF headers for unsafe requests', async () => {
    document.cookie = 'updspace_csrf=formdata-csrf-token; path=/';

    const form = new FormData();
    form.append('avatar', new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    (fetch as unknown as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    await request('/auth/avatar', { method: 'POST', body: form });

    expect(fetch).toHaveBeenCalledTimes(1);

    const [, options] = (fetch as unknown as vi.Mock).mock.calls[0] as [
      string,
      {
        headers: Record<string, string>;
        body: FormData;
        credentials: string;
      },
    ];

    expect(options.credentials).toBe('include');
    expect(options.body).toBe(form);
    expect(options.headers['X-CSRF-Token']).toBe('formdata-csrf-token');
    expect(options.headers['Content-Type']).toBeUndefined();
  });
});
