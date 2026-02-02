/**
 * Voting API Mock
 * 
 * Mock implementation of the voting API for testing.
 */

import { vi } from 'vitest';
import {
    createPaginatedPolls,
    createPollInfo,
    createVotesList,
    createVoteCastPayload,
} from './fixtures';

export const votingApiMock = {
    fetchPolls: vi.fn(async () => createPaginatedPolls()),
    fetchPoll: vi.fn(async () => createPollInfo().poll),
    fetchPollInfo: vi.fn(async () => createPollInfo()),
    createPoll: vi.fn(async () => createPollInfo().poll),
    updatePoll: vi.fn(async () => createPollInfo().poll),
    deletePoll: vi.fn(async () => undefined),
    castVote: vi.fn(async () => createVoteCastPayload()),
    revokeVote: vi.fn(async () => undefined),
    fetchMyVotes: vi.fn(async () => createVotesList()),
    fetchPollResults: vi.fn(async () => []),
};

export function resetVotingApiMock() {
    Object.values(votingApiMock).forEach(mock => {
        if (typeof mock.mockReset === 'function') {
            mock.mockReset();
        }
    });
    
    // Reset to default implementations
    votingApiMock.fetchPolls.mockImplementation(async () => createPaginatedPolls());
    votingApiMock.fetchPoll.mockImplementation(async () => createPollInfo().poll);
    votingApiMock.fetchPollInfo.mockImplementation(async () => createPollInfo());
    votingApiMock.createPoll.mockImplementation(async () => createPollInfo().poll);
    votingApiMock.updatePoll.mockImplementation(async () => createPollInfo().poll);
    votingApiMock.deletePoll.mockImplementation(async () => undefined);
    votingApiMock.castVote.mockImplementation(async () => createVoteCastPayload());
    votingApiMock.revokeVote.mockImplementation(async () => undefined);
    votingApiMock.fetchMyVotes.mockImplementation(async () => createVotesList());
    votingApiMock.fetchPollResults.mockImplementation(async () => []);
}
