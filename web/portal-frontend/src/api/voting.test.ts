import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  castVote,
  fetchMyVotes,
  fetchPoll,
  fetchPollInfo,
  fetchPollResults,
  fetchPolls,
} from './voting';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('voting api wrappers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls poll endpoints and vote cast with payload', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([{ id: 'p1' }])
      .mockResolvedValueOnce({ id: 'p1' })
      .mockResolvedValueOnce({ poll: { id: 'p1' }, nominations: [], options: [], meta: { has_voted: false, can_vote: true } })
      .mockResolvedValueOnce({ poll_id: 'p1', nomination_id: 'n1', option_id: 'o1' })
      .mockResolvedValueOnce([{ id: 'v1' }])
      .mockResolvedValueOnce({ poll_id: 'p1', nominations: [] });

    await fetchPolls({ scope_type: 'TENANT', scope_id: 'tenant-1' });
    await fetchPoll('p1');
    await fetchPollInfo('p1');
    await castVote({ poll_id: 'p1', nomination_id: 'n1', option_id: 'o1' });
    await fetchMyVotes('p1');
    await fetchPollResults('p1');

    expect(request).toHaveBeenNthCalledWith(1, '/voting/polls?scope_type=TENANT&scope_id=tenant-1');
    expect(request).toHaveBeenNthCalledWith(2, '/voting/polls/p1');
    expect(request).toHaveBeenNthCalledWith(3, '/voting/polls/p1/info');
    expect(request).toHaveBeenNthCalledWith(4, '/voting/votes', { method: 'POST', body: { poll_id: 'p1', nomination_id: 'n1', option_id: 'o1' } });
    expect(request).toHaveBeenNthCalledWith(5, '/voting/polls/p1/votes/me');
    expect(request).toHaveBeenNthCalledWith(6, '/voting/polls/p1/results');
  });
});
