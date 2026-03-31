import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('nominations api mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps nominations list/details with legacy fields and defaults', async () => {
    const { fetchNomination, fetchNominations } =
      await vi.importActual<typeof import('./nominations')>('./nominations');

    vi.mocked(request)
      .mockResolvedValueOnce([
        {
          id: 'n1',
          title: 'Nom 1',
          options: [{ id: 'o1', title: 'Option 1', image_url: 'img', game: { id: 'g1', title: 'Game' } }],
          user_vote: 'o1',
          is_voting_open: true,
          can_vote: true,
          requires_telegram_link: false,
          voting_deadline: '2026-01-01',
          type: 'custom',
        },
      ])
      .mockResolvedValueOnce({
        id: 'n2',
        title: 'Nom 2',
        options: [],
        voting: { id: 'v1', title: 'Vote', is_active: false, is_open: false, is_public: false },
      });

    const list = await fetchNominations('award');
    const detail = await fetchNomination('n2');

    expect(request).toHaveBeenNthCalledWith(1, '/voting/nominations/?voting=award');
    expect(list[0]).toMatchObject({ id: 'n1', userVote: 'o1', kind: 'custom', canVote: true });
    expect(detail.voting).toMatchObject({ id: 'v1', isActive: false, isOpen: false, isPublic: false });
  });

  it('maps vote result including fallbacks for user vote and flags', async () => {
    const { voteForOption } = await vi.importActual<typeof import('./nominations')>('./nominations');

    vi.mocked(request).mockResolvedValueOnce({
      nomination_id: 'n1',
      option_id: 'o2',
      counts: { o1: 2, o2: 3 },
      is_voting_open: false,
      can_vote: false,
      requires_telegram_link: true,
      voting_deadline: '2026-01-03',
    });

    const result = await voteForOption({ nominationId: 'n1', optionId: 'o2' });

    expect(request).toHaveBeenCalledWith('/voting/nominations/n1/vote', {
      method: 'POST',
      body: { option_id: 'o2' },
    });
    expect(result).toMatchObject({ optionId: 'o2', userVote: 'o2', isVotingOpen: false });
  });
});
