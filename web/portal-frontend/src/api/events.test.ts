import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEvents } from './events';
import { request } from './client';
import { ApiError } from './client';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

describe('events api', () => {
  const mockedRequest = vi.mocked(request);

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('maps scope filters to snake_case query params', async () => {
    mockedRequest.mockResolvedValue({
      items: [],
      meta: { total: 0, limit: 20, offset: 0 },
    });

    await fetchEvents({
      from: '2026-02-06T00:00:00.000Z',
      to: '2026-02-07T00:00:00.000Z',
      scopeType: 'TENANT',
      scopeId: 'tenant-1',
      limit: 20,
      offset: 0,
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      '/events?from=2026-02-06T00%3A00%3A00.000Z&to=2026-02-07T00%3A00%3A00.000Z&scope_type=TENANT&scope_id=tenant-1&limit=20&offset=0',
    );
  });

  it('requests events root when filters are not provided', async () => {
    mockedRequest.mockResolvedValue({
      items: [],
      meta: { total: 0, limit: 100, offset: 0 },
    });

    await fetchEvents();

    expect(mockedRequest).toHaveBeenCalledWith('/events');
  });

  it('retries with trailing slash when primary events url returns 404', async () => {
    mockedRequest
      .mockRejectedValueOnce(
        new ApiError('Not found', {
          status: 404,
          kind: 'not_found',
        }),
      )
      .mockResolvedValueOnce({
        items: [],
        meta: { total: 0, limit: 100, offset: 0 },
      });

    await fetchEvents();

    expect(mockedRequest).toHaveBeenNthCalledWith(1, '/events');
    expect(mockedRequest).toHaveBeenNthCalledWith(2, '/events/');
  });
});
