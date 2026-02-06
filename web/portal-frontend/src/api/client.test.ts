import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedError } from './accessDenied';
import { request, requestResult } from './client';

global.fetch = vi.fn();

describe('requestResult business handling', () => {
  afterEach(() => {
    vi.resetAllMocks();
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
});
