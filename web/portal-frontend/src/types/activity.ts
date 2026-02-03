/**
 * Activity Service TypeScript Types
 *
 * Полные типы для работы с Activity Service API.
 * Синхронизированы с backend schemas.py
 *
 * @module activity/types
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Типы источников данных
 */
export type SourceType = 'steam' | 'minecraft' | 'discord' | 'custom';

/**
 * Статус привязки аккаунта
 */
export type AccountLinkStatus = 'active' | 'pending' | 'disabled' | 'error';

/**
 * Типы событий активности
 */
export type ActivityEventType =
  | 'vote.cast'
  | 'event.created'
  | 'event.rsvp.changed'
  | 'post.created'
  | 'game.achievement'
  | 'game.playtime'
  | 'steam.private'
  | 'minecraft.session';

/**
 * Статус здоровья сервиса
 */
export type HealthStatus = 'ok' | 'degraded' | 'error';

/**
 * Видимость события
 */
export type EventVisibility = 'public' | 'community' | 'team' | 'private';

/**
 * Тип scope
 */
export type ScopeType = 'tenant' | 'COMMUNITY' | 'TEAM';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Детали ошибки API
 */
export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Стандартный ответ ошибки
 */
export interface ErrorResponse {
  error: ErrorDetail;
}

// ============================================================================
// Health & Monitoring Types
// ============================================================================

/**
 * Результат отдельной проверки здоровья
 */
export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Ответ health endpoint
 */
export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
  checks?: HealthCheck[];
}

/**
 * Метрики сервиса
 */
export interface MetricsResponse {
  activityEventsTotal: number;
  rawEventsTotal: number;
  accountLinksTotal: number;
  outboxPending: number;
  outboxFailed: number;
  timestamp: string;
}

// ============================================================================
// Activity Event Types
// ============================================================================

/**
 * Событие активности
 */
export interface ActivityEvent {
  id: number;
  tenantId: string;
  actorUserId: string | null;
  targetUserId: string | null;
  type: string;
  occurredAt: string;
  title: string;
  payloadJson: Record<string, unknown>;
  visibility: EventVisibility;
  scopeType: string;
  scopeId: string;
  sourceRef: string;
}

/**
 * Ответ legacy feed endpoint
 */
export interface FeedResponse {
  items: ActivityEvent[];
}

/**
 * Ответ v2 feed endpoint с курсорной пагинацией
 */
export interface FeedResponseV2 {
  items: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Параметры запроса feed
 */
export interface FeedParams {
  from?: string;
  to?: string;
  types?: string;
  scopeType?: string;
  scopeId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Счётчик непрочитанных
 */
export interface UnreadCountResponse {
  count: number;
}

export type NewsMediaImage = {
  type: 'image';
  key: string;
  url?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
};

export type NewsMediaYoutube = {
  type: 'youtube';
  url: string;
  video_id: string;
  title?: string | null;
};

export type NewsMediaItem = NewsMediaImage | NewsMediaYoutube;

export type NewsPayload = {
  news_id?: string;
  title?: string | null;
  body: string;
  tags: string[];
  media?: NewsMediaItem[];
  comments_count?: number;
  reactions_count?: number;
};

// ============================================================================
// Games Types
// ============================================================================

/**
 * Игра в каталоге тенанта
 */
export interface Game {
  id: number;
  tenantId: string;
  name: string;
  tagsJson: Record<string, unknown>;
}

/**
 * Payload для создания игры
 */
export interface GameCreatePayload {
  name: string;
  tagsJson?: Record<string, unknown>;
}

// ============================================================================
// Sources Types
// ============================================================================

/**
 * Источник данных
 */
export interface Source {
  id: number;
  tenantId: string;
  type: SourceType;
}

/**
 * Детальная информация об источнике (admin)
 */
export interface SourceDetail extends Source {
  configJson: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// Account Links Types
// ============================================================================

/**
 * Привязка аккаунта пользователя к источнику
 */
export interface AccountLink {
  id: number;
  tenantId: string;
  userId: string;
  sourceId: number;
  status: AccountLinkStatus;
  settingsJson: Record<string, unknown>;
  externalIdentityRef: string | null;
}

/**
 * Детальная информация о привязке
 */
export interface AccountLinkDetail extends AccountLink {
  sourceType: SourceType;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/**
 * Payload для создания привязки
 */
export interface AccountLinkCreatePayload {
  sourceId: number;
  status?: AccountLinkStatus;
  settingsJson?: Record<string, unknown>;
  externalIdentityRef?: string;
}

// ============================================================================
// Subscriptions Types
// ============================================================================

/**
 * Правило подписки на scope
 */
export interface ScopeRule {
  scopeType: ScopeType;
  scopeId: string;
}

/**
 * Payload для подписки
 */
export interface SubscriptionPayload {
  scopes: ScopeRule[];
}

/**
 * Подписка пользователя
 */
export interface Subscription {
  id: number;
  tenantId: string;
  userId: string;
  rulesJson: Record<string, unknown>;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Результат операции синхронизации
 */
export interface SyncRunResult {
  ok: boolean;
  rawCreated: number;
  rawDeduped: number;
  activityCreated: number;
}

/**
 * Статус синхронизации для привязки
 */
export interface SyncStatus {
  accountLinkId: number;
  sourceType: SourceType;
  lastSyncAt: string | null;
  lastError: string | null;
  nextSyncAt: string | null;
  isSyncing: boolean;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Результат обработки webhook
 */
export interface WebhookIngestResult {
  ok: boolean;
  rawCreated: number;
  rawDeduped: number;
  activityCreated: number;
}

// ============================================================================
// SSE Types
// ============================================================================

/**
 * Типы SSE событий
 */
export type SSEEventType = 'unread' | 'heartbeat' | 'close' | 'error';

/**
 * SSE событие
 */
export interface SSEEvent {
  event: SSEEventType;
  count?: number;
  timestamp?: string;
  message?: string;
  reason?: string;
}

// ============================================================================
// Outbox Types (Admin/Debug)
// ============================================================================

/**
 * Событие в outbox (для админки)
 */
export interface OutboxEvent {
  id: number;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  processedAt: string | null;
  retryCount: number;
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Generic list response
 */
export interface ListResponse<T> {
  items: T[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isActivityEvent(obj: unknown): obj is ActivityEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'title' in obj &&
    'occurredAt' in obj
  );
}

export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as ErrorResponse).error === 'object' &&
    (obj as ErrorResponse).error !== null
  );
}

export function isFeedResponseV2(obj: unknown): obj is FeedResponseV2 {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'items' in obj &&
    'hasMore' in obj &&
    Array.isArray((obj as FeedResponseV2).items)
  );
}
