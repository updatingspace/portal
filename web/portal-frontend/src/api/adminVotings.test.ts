import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./adminVotings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adminVotings')>();
  return actual;
});
vi.mock('./client', () => ({ request: vi.fn() }));

import { request } from './client';
import {
  fetchAdminStats,
  fetchAdminVoting,
  fetchAdminVotings,
  updateAdminVotingMeta,
} from './adminVotings';

describe('adminVotings api mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps list statuses and supports title search filter', async () => {
    vi.mocked(request).mockResolvedValue([
      { id: 'v1', title: 'Draft vote', is_public: false, is_active: true, is_open: true, nomination_count: 1 },
      { id: 'v2', title: 'Archived vote', is_public: true, is_active: false, is_open: false, nomination_count: 2 },
      { id: 'v3', title: 'Active vote', is_public: true, is_active: true, is_open: true, nomination_count: 3 },
    ]);

    const all = await fetchAdminVotings();
    const filtered = await fetchAdminVotings('active');

    expect(request).toHaveBeenCalledWith('/voting/admin/votings');
    expect(all.map((x) => x.status)).toEqual(['draft', 'archived', 'active']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('v3');
  });

  it('maps detail nominations and sends normalized update payload', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        id: 'v1',
        title: 'Vote',
        is_public: true,
        is_active: true,
        is_open: true,
        nominations: [{ id: 'n1', title: 'Nom 1', status: 'active', updated_at: '2026-01-01' }],
      })
      .mockResolvedValueOnce({
        id: 'v1',
        title: 'Vote updated',
        isPublic: true,
        isActive: false,
        isOpen: false,
        nominations: [],
      })
      .mockResolvedValueOnce({ activeVotings: 1, draftVotings: 2, archivedVotings: 3, totalVotes: 10, uniqueVoters: 9, openNominations: 4, openForVoting: 5 });

    const detail = await fetchAdminVoting('v1');
    const updated = await updateAdminVotingMeta('v1', {
      title: 'Vote updated',
      isPublished: true,
      isActive: false,
      closeNow: true,
      showVoteCounts: true,
    });
    const stats = await fetchAdminStats();

    expect(detail.nominations[0].updatedAt).toBe('2026-01-01');
    expect(updated.status).toBe('archived');
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/voting/admin/votings/v1',
      expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ isPublic: true, isActive: false, closeNow: true }) }),
    );
    expect(stats.totalVotes).toBe(10);
  });
});
