import { describe, expect, it, vi } from 'vitest';

import { fetchBackendVersion } from './version';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('version api', () => {
  it('requests backend version endpoint', async () => {
    vi.mocked(request).mockResolvedValueOnce({ build_id: 'b1', api_version: 'v1' });

    await expect(fetchBackendVersion()).resolves.toEqual({ build_id: 'b1', api_version: 'v1' });
    expect(request).toHaveBeenCalledWith('/version');
  });
});
