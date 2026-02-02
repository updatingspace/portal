/**
 * Events Feature - Type Definitions
 * 
 * These types match the backend schemas from services/events/src/events/schemas.py
 */

// ============================================================================
// Enums / Literal Types
// ============================================================================

export type EventScopeType = 'TENANT' | 'COMMUNITY' | 'TEAM';
export type EventVisibility = 'public' | 'community' | 'team' | 'private';
export type RsvpStatus = 'interested' | 'going' | 'not_going';

// ============================================================================
// Core Models
// ============================================================================

/**
 * Base Event interface - core event data
 */
export interface Event {
  id: string;
  tenantId: string;
  scopeType: EventScopeType;
  scopeId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  locationText?: string | null;
  locationUrl?: string | null;
  gameId?: string | null;
  visibility: EventVisibility;
  createdBy: string;
  createdAt: string;
}

/**
 * RSVP counts breakdown by status
 */
export interface RsvpCounts {
  interested: number;
  going: number;
  not_going: number;
}

/**
 * Event with RSVP counts and user's own RSVP status
 * This is what the backend returns in EventOut
 */
export interface EventWithCounts extends Event {
  rsvpCounts: RsvpCounts;
  myRsvp: RsvpStatus | null;
}

/**
 * Pagination metadata for list responses
 */
export interface EventListMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Paginated list response with items and metadata
 */
export interface EventListResponse {
  items: EventWithCounts[];
  meta: EventListMeta;
}

// ============================================================================
// API Request Payloads
// ============================================================================

/**
 * Create Event request payload
 */
export interface CreateEventPayload {
  scopeType: EventScopeType;
  scopeId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  locationText?: string;
  locationUrl?: string;
  gameId?: string;
  visibility?: EventVisibility;
}

/**
 * Update Event request payload - all fields are optional
 */
export interface UpdateEventPayload {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  locationText?: string | null;
  locationUrl?: string | null;
  gameId?: string | null;
  visibility?: EventVisibility;
}

/**
 * Set RSVP status request payload
 */
export interface SetRsvpPayload {
  status: RsvpStatus;
}

/**
 * Mark attendance request payload
 */
export interface MarkAttendancePayload {
  userId: string;
}

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Query parameters for listing events
 */
export interface FetchEventsParams {
  from?: string;     // ISO datetime
  to?: string;       // ISO datetime
  scopeType?: string;
  scopeId?: string;
  limit?: number;    // 1-250, default 100
  offset?: number;   // default 0
}
