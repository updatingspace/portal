/**
 * Voting Feature - API Client
 * 
 * Low-level API functions for voting service.
 * Uses the existing request client with rate limit handling.
 */

import { request, isApiError } from '../../../api/client';
import type {
  Poll,
  PollCreatePayload,
  PollUpdatePayload,
  PollResults,
  PaginatedResponse,
  PollsQueryParams,
  Nomination,
  NominationCreatePayload,
  NominationUpdatePayload,
  Option,
  OptionCreatePayload,
  OptionUpdatePayload,
  Vote,
  VoteCastPayload,
  PollParticipant,
  ParticipantAddPayload,
  PollTemplate,
  PollDetailedInfo,
  PollInfoResponse,
  NominationWithOptions,
} from '../types';

// ============================================================================
// Rate Limit Handling
// ============================================================================

export interface RateLimitInfo {
  retryAfter: number;
  limit: number;
  window: number;
}

export class RateLimitError extends Error {
  public retryAfter: number;
  public limit: number;
  public window: number;

  constructor(message: string, info: RateLimitInfo) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = info.retryAfter;
    this.limit = info.limit;
    this.window = info.window;
  }
}

export const isRateLimitError = (error: unknown): error is RateLimitError => {
  return error instanceof RateLimitError;
};

const handleApiError = (error: unknown): never => {
  if (isApiError(error)) {
    // Check for rate limit error
    if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
      const details = error.details as { retry_after?: number; limit?: number; window?: number } | undefined;
      throw new RateLimitError(error.message, {
        retryAfter: details?.retry_after ?? 60,
        limit: details?.limit ?? 10,
        window: details?.window ?? 60,
      });
    }
  }
  throw error;
};

// ============================================================================
// Polls API
// ============================================================================

const VOTING_BASE = '/voting';

export async function fetchPolls(params?: PollsQueryParams): Promise<PaginatedResponse<Poll>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.scope_type) searchParams.set('scope_type', params.scope_type);
    if (params?.scope_id) searchParams.set('scope_id', params.scope_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
    
    const query = searchParams.toString();
    const url = query ? `${VOTING_BASE}/polls?${query}` : `${VOTING_BASE}/polls`;
    
    return await request<PaginatedResponse<Poll>>(url);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function fetchPoll(pollId: string): Promise<Poll> {
  try {
    return await request<Poll>(`${VOTING_BASE}/polls/${pollId}`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function fetchPollInfo(pollId: string): Promise<PollDetailedInfo> {
  try {
    const response = await request<PollInfoResponse>(`${VOTING_BASE}/polls/${pollId}/info`);

    const optionsByNomination = new Map<string, Option[]>();
    for (const option of response.options) {
      const list = optionsByNomination.get(option.nomination_id) ?? [];
      list.push(option);
      optionsByNomination.set(option.nomination_id, list);
    }

    for (const options of optionsByNomination.values()) {
      options.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    const nominations: NominationWithOptions[] = response.nominations.map((nomination) => ({
      ...nomination,
      options: optionsByNomination.get(nomination.id) ?? [],
    }));

    return {
      poll: response.poll,
      nominations,
      meta: response.meta,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

export async function createPoll(payload: PollCreatePayload): Promise<Poll> {
  try {
    return await request<Poll>(`${VOTING_BASE}/polls`, {
      method: 'POST',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function updatePoll(pollId: string, payload: PollUpdatePayload): Promise<Poll> {
  try {
    return await request<Poll>(`${VOTING_BASE}/polls/${pollId}`, {
      method: 'PUT',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function deletePoll(pollId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>(`${VOTING_BASE}/polls/${pollId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function fetchPollTemplates(): Promise<PollTemplate[]> {
  try {
    return await request<PollTemplate[]>(`${VOTING_BASE}/polls/templates`);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Nominations API
// ============================================================================

export async function createNomination(pollId: string, payload: NominationCreatePayload): Promise<Nomination> {
  try {
    return await request<Nomination>(`${VOTING_BASE}/polls/${pollId}/nominations`, {
      method: 'POST',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function updateNomination(
  pollId: string,
  nominationId: string,
  payload: NominationUpdatePayload
): Promise<Nomination> {
  try {
    return await request<Nomination>(`${VOTING_BASE}/polls/${pollId}/nominations/${nominationId}`, {
      method: 'PUT',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function deleteNomination(pollId: string, nominationId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>(`${VOTING_BASE}/polls/${pollId}/nominations/${nominationId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Options API
// ============================================================================

export async function createOption(
  pollId: string,
  nominationId: string,
  payload: OptionCreatePayload
): Promise<Option> {
  try {
    return await request<Option>(`${VOTING_BASE}/polls/${pollId}/nominations/${nominationId}/options`, {
      method: 'POST',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function updateOption(
  pollId: string,
  optionId: string,
  payload: OptionUpdatePayload
): Promise<Option> {
  try {
    return await request<Option>(`${VOTING_BASE}/polls/${pollId}/options/${optionId}`, {
      method: 'PUT',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function deleteOption(pollId: string, optionId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>(`${VOTING_BASE}/polls/${pollId}/options/${optionId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Votes API
// ============================================================================

export async function castVote(payload: VoteCastPayload): Promise<VoteCastPayload> {
  try {
    return await request<VoteCastPayload>(`${VOTING_BASE}/votes`, {
      method: 'POST',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function revokeVote(voteId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>(`${VOTING_BASE}/votes/${voteId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function fetchMyVotes(pollId: string): Promise<Vote[]> {
  try {
    return await request<Vote[]>(`${VOTING_BASE}/polls/${pollId}/votes/me`);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Results API
// ============================================================================

export async function fetchPollResults(pollId: string): Promise<PollResults> {
  try {
    return await request<PollResults>(`${VOTING_BASE}/polls/${pollId}/results`);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Participants API
// ============================================================================

export async function fetchParticipants(pollId: string): Promise<PollParticipant[]> {
  try {
    return await request<PollParticipant[]>(`${VOTING_BASE}/polls/${pollId}/participants`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function addParticipant(pollId: string, payload: ParticipantAddPayload): Promise<PollParticipant> {
  try {
    return await request<PollParticipant>(`${VOTING_BASE}/polls/${pollId}/participants`, {
      method: 'POST',
      body: payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function removeParticipant(pollId: string, userId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>(`${VOTING_BASE}/polls/${pollId}/participants/${userId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
