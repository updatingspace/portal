/**
 * Activity Service API Client
 *
 * Полный API клиент для работы с Activity Service.
 * Поддерживает v1 (legacy) и v2 (cursor pagination) endpoints.
 *
 * @module api/activity
 */

import { request } from './client';
import type {
  ActivityEvent,
  FeedResponse,
  FeedResponseV2,
  FeedParams,
  UnreadCountResponse,
  Game,
  GameCreatePayload,
  Source,
  SourceDetail,
  AccountLink,
  AccountLinkDetail,
  AccountLinkCreatePayload,
  Subscription,
  SubscriptionPayload,
  SyncRunResult,
  SyncStatus,
  HealthResponse,
  MetricsResponse,
} from '../types/activity';

// Re-export types for backward compatibility
export type { ActivityEvent, FeedResponse, FeedResponseV2, FeedParams };

// Legacy export alias
export type ActivityItem = ActivityEvent;

// ============================================================================
// Feed API
// ============================================================================

/**
 * Build query string from FeedParams
 */
function buildFeedQuery(params?: FeedParams): string {
  const queryParams = new URLSearchParams();
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);
  if (params?.types) queryParams.set('types', params.types);
  if (params?.scopeType) queryParams.set('scope_type', params.scopeType);
  if (params?.scopeId) queryParams.set('scope_id', params.scopeId);
  if (typeof params?.limit === 'number') queryParams.set('limit', String(params.limit));
  if (params?.cursor) queryParams.set('cursor', params.cursor);
  return queryParams.toString();
}

/**
 * Fetch activity feed (legacy endpoint, offset-based)
 *
 * @deprecated Use fetchFeedV2 for cursor-based pagination
 */
export async function fetchFeed(params?: Omit<FeedParams, 'cursor'>): Promise<ActivityEvent[]> {
  const query = buildFeedQuery(params);
  const url = query ? `/activity/feed?${query}` : '/activity/feed';
  const data = await request<FeedResponse>(url);
  return data.items;
}

/**
 * Fetch activity feed with cursor-based pagination (v2)
 *
 * @example
 * // First page
 * const { items, nextCursor, hasMore } = await fetchFeedV2({ limit: 20 });
 *
 * // Next page
 * if (hasMore && nextCursor) {
 *   const nextPage = await fetchFeedV2({ limit: 20, cursor: nextCursor });
 * }
 */
export async function fetchFeedV2(params?: FeedParams): Promise<FeedResponseV2> {
  const query = buildFeedQuery(params);
  const url = query ? `/activity/v2/feed?${query}` : '/activity/v2/feed';
  return request<FeedResponseV2>(url);
}

/**
 * Get unread count for current user
 */
export async function fetchUnreadCount(): Promise<number> {
  const data = await request<UnreadCountResponse>('/activity/feed/unread-count');
  return data.count;
}

/**
 * Mark feed as read (updates last_seen timestamp)
 */
export async function markFeedAsRead(): Promise<void> {
  await request('/activity/feed/mark-read', { method: 'POST' });
}

// ============================================================================
// Games API
// ============================================================================

/**
 * Fetch games catalog for tenant
 */
export async function fetchActivityGames(): Promise<Game[]> {
  const data = await request<{ items: Game[] }>('/activity/games');
  return data.items;
}

/**
 * Create a new game (admin)
 */
export async function createActivityGame(payload: GameCreatePayload): Promise<Game> {
  return request<Game>('/activity/games', {
    method: 'POST',
    body: payload,
  });
}

// ============================================================================
// Sources API
// ============================================================================

/**
 * Fetch available sources for tenant
 */
export async function fetchSources(): Promise<Source[]> {
  const data = await request<{ items: Source[] }>('/activity/sources');
  return data.items;
}

/**
 * Get source details (admin)
 */
export async function fetchSourceDetail(sourceId: number): Promise<SourceDetail> {
  return request<SourceDetail>(`/activity/sources/${sourceId}`);
}

// ============================================================================
// Account Links API
// ============================================================================

/**
 * Fetch user's account links
 */
export async function fetchAccountLinks(): Promise<AccountLink[]> {
  const data = await request<{ items: AccountLink[] }>('/activity/account-links');
  return data.items;
}

/**
 * Get detailed account link info
 */
export async function fetchAccountLinkDetail(linkId: number): Promise<AccountLinkDetail> {
  return request<AccountLinkDetail>(`/activity/account-links/${linkId}`);
}

/**
 * Create account link (connect external account)
 *
 * @example
 * // Link Steam account
 * const link = await createAccountLink({
 *   sourceId: steamSourceId,
 *   settingsJson: { steam_id: '76561198012345678' },
 * });
 */
export async function createAccountLink(payload: AccountLinkCreatePayload): Promise<AccountLink> {
  return request<AccountLink>('/activity/account-links', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Update account link status
 */
export async function updateAccountLink(
  linkId: number,
  payload: Partial<AccountLinkCreatePayload>,
): Promise<AccountLink> {
  return request<AccountLink>(`/activity/account-links/${linkId}`, {
    method: 'PATCH',
    body: payload,
  });
}

/**
 * Delete account link
 */
export async function deleteAccountLink(linkId: number): Promise<void> {
  await request(`/activity/account-links/${linkId}`, { method: 'DELETE' });
}

// ============================================================================
// Subscriptions API
// ============================================================================

/**
 * Fetch user's subscriptions
 */
export async function fetchSubscriptions(): Promise<Subscription[]> {
  const data = await request<{ items: Subscription[] }>('/activity/subscriptions');
  return data.items;
}

/**
 * Update user subscriptions
 *
 * @example
 * await updateSubscriptions({
 *   scopes: [
 *     { scopeType: 'COMMUNITY', scopeId: 'community-uuid' },
 *     { scopeType: 'TEAM', scopeId: 'team-uuid' },
 *   ],
 * });
 */
export async function updateSubscriptions(payload: SubscriptionPayload): Promise<Subscription> {
  return request<Subscription>('/activity/subscriptions', {
    method: 'POST',
    body: payload,
  });
}

// ============================================================================
// Sync API (Admin)
// ============================================================================

/**
 * Trigger manual sync for all account links (admin)
 */
export async function triggerSync(): Promise<SyncRunResult> {
  return request<SyncRunResult>('/activity/sync/run', { method: 'POST' });
}

/**
 * Get sync status for account link
 */
export async function fetchSyncStatus(linkId: number): Promise<SyncStatus> {
  return request<SyncStatus>(`/activity/sync/status/${linkId}`);
}

// ============================================================================
// Health API
// ============================================================================

/**
 * Check service health
 */
export async function fetchActivityHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/activity/health');
}

/**
 * Fetch service metrics (admin)
 */
export async function fetchActivityMetrics(): Promise<MetricsResponse> {
  return request<MetricsResponse>('/activity/metrics');
}

// ============================================================================
// SSE (Server-Sent Events)
// ============================================================================

/**
 * Subscribe to real-time unread count updates via SSE
 *
 * @example
 * const eventSource = subscribeToUnreadCount((count) => {
 *   console.log('Unread count:', count);
 * });
 *
 * // Later: cleanup
 * eventSource.close();
 */
export function subscribeToUnreadCount(
  onUpdate: (count: number) => void,
  onError?: (error: Event) => void,
): EventSource {
  const baseUrl = '/api/v1/activity/feed/sse';
  const eventSource = new EventSource(baseUrl, { withCredentials: true });

  eventSource.addEventListener('unread', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (typeof data.count === 'number') {
        onUpdate(data.count);
      }
    } catch {
      console.error('Failed to parse SSE event:', event.data);
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    // Keep-alive, no action needed
  });

  eventSource.addEventListener('error', (event) => {
    if (onError) {
      onError(event);
    }
  });

  return eventSource;
}

