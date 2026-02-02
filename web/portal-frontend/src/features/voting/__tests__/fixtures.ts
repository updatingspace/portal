/**
 * Voting Feature Test Fixtures
 * 
 * Test data generators for voting feature tests.
 */

import type {
    Poll,
    Nomination,
    Option,
    Vote,
    PollDetailedInfo,
    PaginatedResponse,
    VoteCastPayload,
    NominationWithOptions,
} from '../types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Base poll data
const basePoll: Poll = {
    id: 'poll-1',
    tenant_id: 'tenant-123',
    title: 'Test Poll',
    status: 'active',
    scope_type: 'TENANT',
    scope_id: 'tenant-123',
    visibility: 'public',
    created_by: 'user-1',
    description: 'A test poll for unit testing',
    allow_revoting: true,
    anonymous: false,
    results_visibility: 'after_closed',
    settings: {},
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-02T12:00:00Z',
};

const baseNomination: Nomination = {
    id: 'nom-1',
    poll_id: 'poll-1',
    title: 'Best Feature',
    description: 'Vote for the best feature',
    kind: 'custom',
    sort_order: 0,
    max_votes: 1,
    is_required: false,
    config: {},
};

const baseOption: Option = {
    id: 'opt-1',
    nomination_id: 'nom-1',
    title: 'Option A',
    description: 'First option',
    sort_order: 0,
};

const baseVote: Vote = {
    id: 'vote-1',
    poll_id: 'poll-1',
    nomination_id: 'nom-1',
    option_id: 'opt-1',
    user_id: 'user-1',
    created_at: '2025-01-02T14:00:00Z',
};

// Generators

export function createPoll(overrides: Partial<Poll> = {}): Poll {
    return clone({ ...basePoll, ...overrides });
}

export function createNomination(overrides: Partial<Nomination> = {}): Nomination {
    return clone({ ...baseNomination, ...overrides });
}

export function createOption(overrides: Partial<Option> = {}): Option {
    return clone({ ...baseOption, ...overrides });
}

export function createVote(overrides: Partial<Vote> = {}): Vote {
    return clone({ ...baseVote, ...overrides });
}

export function createPollWithNominations(
    pollOverrides: Partial<Poll> = {},
    nominationCount: number = 2,
    optionsPerNomination: number = 3
): { poll: Poll; nominations: NominationWithOptions[] } {
    const poll = createPoll(pollOverrides);
    
    const nominations: NominationWithOptions[] = [];
    for (let i = 0; i < nominationCount; i++) {
        const options: Option[] = [];
        for (let j = 0; j < optionsPerNomination; j++) {
            options.push(createOption({
                id: `opt-${i}-${j}`,
                nomination_id: `nom-${i}`,
                title: `Option ${String.fromCharCode(65 + j)}`,
                sort_order: j,
            }));
        }
        
        const nominationBase = createNomination({
            id: `nom-${i}`,
            poll_id: poll.id,
            title: `Nomination ${i + 1}`,
            sort_order: i,
        });
        nominations.push({
            ...nominationBase,
            options,
        });
    }
    
    return { poll, nominations };
}

export function createPollInfo(overrides: Partial<PollDetailedInfo> = {}): PollDetailedInfo {
    const { meta: metaOverrides, ...restOverrides } = overrides;
    const { poll, nominations } = createPollWithNominations();
    
    return {
        poll,
        nominations,
        meta: {
            has_voted: false,
            can_vote: true,
            ...(metaOverrides ?? {}),
        },
        ...restOverrides,
    };
}

export function createVoteCastPayload(overrides: Partial<VoteCastPayload> = {}): VoteCastPayload {
    return {
        poll_id: 'poll-1',
        nomination_id: 'nom-1',
        option_id: 'opt-1',
        ...overrides,
    };
}

export function createPaginatedPolls(
    pollCount: number = 5,
    options: { limit?: number; offset?: number; total?: number } = {}
): PaginatedResponse<Poll> {
    const { limit = 20, offset = 0, total = pollCount } = options;
    
    const items: Poll[] = [];
    for (let i = 0; i < pollCount; i++) {
        items.push(createPoll({
            id: `poll-${offset + i}`,
            title: `Test Poll ${offset + i + 1}`,
        }));
    }
    
    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            has_next: offset + pollCount < total,
            has_prev: offset > 0,
        },
    };
}

export function createVotesList(count: number = 2): Vote[] {
    return Array.from({ length: count }, (_, i) => 
        createVote({
            id: `vote-${i}`,
            nomination_id: `nom-${i}`,
            option_id: `opt-${i}-0`,
        })
    );
}

// Error responses

export function createRateLimitError(retryAfter: number = 60): Response {
    return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retry_after: retryAfter,
    }), {
        status: 429,
        headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
        },
    });
}

export function createAlreadyVotedError(): Response {
    return new Response(JSON.stringify({
        error: {
            code: 'ALREADY_VOTED',
            message: 'You have already voted in this nomination',
        },
    }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function createForbiddenError(): Response {
    return new Response(JSON.stringify({
        error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
        },
    }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
    });
}
