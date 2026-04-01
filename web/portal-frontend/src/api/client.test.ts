import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedError } from './accessDenied';
import { request, requestResult } from './client';

global.fetch = vi.fn();

const createResponse = ({
  ok,
  status,
  payload,
}: {
  ok: boolean;
  status: number;
  payload: unknown;
}) => ({
  ok,
  status,
  json: async () => payload,
  clone() {
    return this;
  },
  headers: new Headers(),
});

const mockFetchResponse = ({
  ok = true,
  status = 200,
  payload = { ok: true },
}: {
  ok?: boolean;
  status?: number;
  payload?: unknown;
} = {}) => {
  (fetch as unknown as vi.Mock).mockResolvedValue(
    createResponse({ ok, status, payload }),
  );
};

const mockForbiddenResponse = (requestId: string) => {
  mockFetchResponse({
    ok: false,
    status: 403,
    payload: {
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden by Access service',
        request_id: requestId,
      },
    },
  });
};

const performUnsafeFormDataRequest = async () => {
  document.cookie = 'updspace_csrf=formdata-csrf-token; path=/';
  const form = new FormData();
  form.append('avatar', new File(['avatar'], 'avatar.png', { type: 'image/png' }));
  mockFetchResponse();

  await request('/auth/avatar', { method: 'POST', body: form });

  const [, options] = (fetch as unknown as vi.Mock).mock.calls[0] as [
    string,
    {
      headers: Record<string, string>;
      body: FormData;
      credentials: string;
    },
  ];

  return { form, options };
};

describe('requestResult business handling', () => {
  afterEach(() => {
    vi.resetAllMocks();
    document.cookie = 'updspace_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('calls csrf bootstrap endpoint before unsafe requests when cookie is missing', async () => {
    (fetch as unknown as vi.Mock)
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          status: 200,
          payload: { csrfToken: 'bootstrap-token' },
        }),
      )
      .mockResolvedValueOnce(createResponse({ ok: true, status: 200, payload: { ok: true } }));

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
  });

  it('uses bootstrap csrf token in unsafe request headers after bootstrap call', async () => {
    (fetch as unknown as vi.Mock)
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          status: 200,
          payload: { csrfToken: 'bootstrap-token' },
        }),
      )
      .mockResolvedValueOnce(createResponse({ ok: true, status: 200, payload: { ok: true } }));

    await requestResult('/test', { method: 'POST' });

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

  it('sends unsafe request once when csrf cookie already exists', async () => {
    document.cookie = 'updspace_csrf=cookie-token; path=/';
    mockFetchResponse();

    const res = await requestResult('/test', { method: 'POST' });

    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses csrf token from cookie in unsafe request headers', async () => {
    document.cookie = 'updspace_csrf=cookie-token; path=/';
    mockFetchResponse();

    await requestResult('/test', { method: 'POST' });

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

  it('returns failed result for known 429 response', async () => {
    mockFetchResponse({
      ok: false,
      status: 429,
      payload: { code: 'LOGIN_RATE_LIMITED', retry_after_seconds: 10 },
    });

    const res = await requestResult('/test', { method: 'POST' });

    expect(res).toMatchObject({ ok: false, status: 429 });
  });

  it('exposes known business error code for 429 response', async () => {
    mockFetchResponse({
      ok: false,
      status: 429,
      payload: { code: 'LOGIN_RATE_LIMITED', retry_after_seconds: 10 },
    });

    const res = await requestResult('/test', { method: 'POST' });

    expect(res).toMatchObject({
      ok: false,
      error: {
        code: 'LOGIN_RATE_LIMITED',
      },
    });
  });

  it('throws AccessDeniedError when request receives 403', async () => {
    mockForbiddenResponse('req-403');

    await expect(request('/test/protected')).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('keeps request metadata in AccessDeniedError when request receives 403', async () => {
    mockForbiddenResponse('req-403');

    await expect(request('/test/protected')).rejects.toMatchObject({
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
      ...createResponse({
        ok: false,
        status: 403,
        payload: {
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden by Access service',
            request_id: 'req-403-race',
          },
        },
      }),
    });

    await expect(pending).rejects.toMatchObject({
      requestId: 'req-403-race',
      path: '/app/feed',
    });
  });

  it('preserves FormData body in unsafe request options', async () => {
    const { form, options } = await performUnsafeFormDataRequest();
    expect(options.credentials).toBe('include');
    expect(options.body).toBe(form);
  });

  it('adds csrf header for unsafe FormData requests', async () => {
    const { options } = await performUnsafeFormDataRequest();
    expect(options.headers['X-CSRF-Token']).toBe('formdata-csrf-token');
  });

  it('does not set JSON content type for FormData requests', async () => {
    const { options } = await performUnsafeFormDataRequest();
    expect(options.headers['Content-Type']).toBeUndefined();
  });
});
