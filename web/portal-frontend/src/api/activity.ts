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
  NewsMediaItem,
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

type ActivityEventApi = {
  id: number;
  tenant_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  type: string;
  occurred_at: string;
  title: string;
  payload_json: Record<string, unknown>;
  visibility: string;
  scope_type: string;
  scope_id: string;
  source_ref: string;
};

type FeedResponseApi = {
  items: ActivityEventApi[];
};

type FeedResponseV2Api = {
  items: ActivityEventApi[];
  next_cursor: string | null;
  has_more: boolean;
};

type SubscriptionApi = {
  id: number;
  tenant_id: string;
  user_id: string;
  rules_json: Record<string, unknown>;
};

const mapActivityEvent = (item: ActivityEventApi): ActivityEvent => ({
  id: item.id,
  tenantId: item.tenant_id,
  actorUserId: item.actor_user_id,
  targetUserId: item.target_user_id,
  type: item.type,
  occurredAt: item.occurred_at,
  title: item.title,
  payloadJson: item.payload_json ?? {},
  visibility: item.visibility as ActivityEvent['visibility'],
  scopeType: item.scope_type,
  scopeId: item.scope_id,
  sourceRef: item.source_ref,
});

const mapSubscription = (item: SubscriptionApi): Subscription => ({
  id: item.id,
  tenantId: item.tenant_id,
  userId: item.user_id,
  rulesJson: item.rules_json ?? {},
});

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
  const data = await request<FeedResponseApi>(url);
  return data.items.map(mapActivityEvent);
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
  const data = await request<FeedResponseV2Api>(url);
  return {
    items: data.items.map(mapActivityEvent),
    nextCursor: data.next_cursor,
    hasMore: data.has_more,
  };
}

/**
 * Get unread count for current user
 */
export async function fetchUnreadCount(): Promise<number> {
  const data = await request<UnreadCountResponse>('/activity/feed/unread-count');
  return data.count;
}

// ============================================================================
// News API
// ============================================================================

export type NewsCreatePayload = {
  title?: string | null;
  body: string;
  tags?: string[];
  visibility: 'public' | 'community' | 'team' | 'private';
  scope_type?: 'TENANT' | 'COMMUNITY' | 'TEAM';
  scope_id?: string | null;
  media?: NewsMediaItem[];
};

export type NewsUpdatePayload = {
  title?: string | null;
  body?: string | null;
  tags?: string[] | null;
  visibility?: 'public' | 'community' | 'team' | 'private' | null;
  media?: NewsMediaItem[] | null;
};

export type NewsUploadPayload = {
  filename: string;
  content_type: string;
  size_bytes: number;
};

export type NewsUploadResponse = {
  key: string;
  upload_url: string;
  upload_headers: Record<string, string>;
  expires_in: number;
};

export async function requestNewsMediaUpload(payload: NewsUploadPayload): Promise<NewsUploadResponse> {
  return request<NewsUploadResponse>('/activity/news/media/upload-url', {
    method: 'POST',
    body: payload,
  });
}

export async function createNews(payload: NewsCreatePayload): Promise<ActivityEvent> {
  const data = await request<ActivityEventApi>('/activity/news', {
    method: 'POST',
    body: {
      title: payload.title ?? undefined,
      body: payload.body,
      tags: payload.tags ?? [],
      visibility: payload.visibility,
      scope_type: payload.scope_type,
      scope_id: payload.scope_id ?? undefined,
      media: payload.media ?? [],
    },
  });
  return mapActivityEvent(data);
}

export async function updateNews(newsId: string, payload: NewsUpdatePayload): Promise<ActivityEvent> {
  const data = await request<ActivityEventApi>(`/activity/news/${newsId}`, {
    method: 'PATCH',
    body: {
      title: payload.title ?? undefined,
      body: payload.body ?? undefined,
      tags: payload.tags ?? undefined,
      visibility: payload.visibility ?? undefined,
      media: payload.media ?? undefined,
    },
  });
  return mapActivityEvent(data);
}

export async function deleteNews(newsId: string): Promise<void> {
  await request(`/activity/news/${newsId}`, { method: 'DELETE' });
}

export async function reactToNews(
  newsId: string,
  payload: { emoji: string; action?: 'add' | 'remove' },
): Promise<{ emoji: string; count: number }[]> {
  return request<{ emoji: string; count: number }[]>(`/activity/news/${newsId}/reactions`, {
    method: 'POST',
    body: {
      emoji: payload.emoji,
      action: payload.action ?? 'add',
    },
  });
}

export async function listNewsComments(newsId: string, limit = 50): Promise<
  { id: number; user_id: string; body: string; created_at: string }[]
> {
  return request<{ id: number; user_id: string; body: string; created_at: string }[]>(
    `/activity/news/${newsId}/comments?limit=${limit}`,
  );
}

export async function createNewsComment(
  newsId: string,
  body: string,
): Promise<{ id: number; user_id: string; body: string; created_at: string }> {
  return request<{ id: number; user_id: string; body: string; created_at: string }>(
    `/activity/news/${newsId}/comments`,
    {
      method: 'POST',
      body: { body },
    },
  );
}

export async function uploadNewsMediaFile(
  uploadUrl: string,
  headers: Record<string, string>,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
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
  const data = await request<{ items: SubscriptionApi[] }>('/activity/subscriptions');
  return data.items.map(mapSubscription);
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
  const scopes = (payload.scopes ?? []).map((scope) => ({
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
  }));
  const data = await request<SubscriptionApi>('/activity/subscriptions', {
    method: 'POST',
    body: { scopes },
  });
  return mapSubscription(data);
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
