import { ApiError, request } from './client';
import type {
    EventWithCounts,
    EventListResponse,
    CreateEventPayload,
    UpdateEventPayload,
    RsvpStatus,
} from '../features/events/types';

// Re-export all types for public API
export type {
    EventScopeType,
    EventVisibility,
    RsvpStatus,
    Event,
    EventWithCounts,
    RsvpCounts,
    EventListMeta,
    EventListResponse,
    CreateEventPayload,
    UpdateEventPayload,
    SetRsvpPayload,
    MarkAttendancePayload,
    FetchEventsParams,
} from '../features/events/types';

// API

export async function fetchEvents(params?: {
    from?: string;
    to?: string;
    scopeType?: string;
    scopeId?: string;
    limit?: number;
    offset?: number;
}): Promise<EventListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);
    if (params?.scopeType) queryParams.set('scope_type', params.scopeType);
    if (params?.scopeId) queryParams.set('scope_id', params.scopeId);
    if (typeof params?.limit === 'number') queryParams.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') queryParams.set('offset', String(params.offset));

    const query = queryParams.toString();
    const basePath = '/events';
    const primaryUrl = query ? `${basePath}?${query}` : basePath;
    const fallbackBasePath = '/events/';
    const fallbackUrl = query ? `${fallbackBasePath}?${query}` : fallbackBasePath;

    try {
        return await request<EventListResponse>(primaryUrl);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return request<EventListResponse>(fallbackUrl);
        }
        throw error;
    }
}

export async function fetchEvent(id: string): Promise<EventWithCounts> {
    return request<EventWithCounts>(`/events/${id}`);
}

export async function createEvent(data: CreateEventPayload): Promise<EventWithCounts> {
    return request<EventWithCounts>('/events', {
        method: 'POST',
        body: data
    });
}

export async function updateEvent(
    id: string,
    data: UpdateEventPayload
): Promise<EventWithCounts> {
    return request<EventWithCounts>(`/events/${id}`, {
        method: 'PATCH',
        body: data
    });
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
    return request<void>(`/events/${eventId}/rsvp`, {
        method: 'POST',
        body: { status }
    });
}

export async function markAttendance(eventId: string, userId: string): Promise<void> {
    return request<void>(`/events/${eventId}/attendance`, {
        method: 'POST',
        body: { userId }
    });
}

export async function exportEventAsIcs(id: string): Promise<Blob> {
    const response = await fetch(`/api/v1/events/${id}/ics`, {
        method: 'GET',
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error(`Failed to export event: ${response.statusText}`);
    }
    return response.blob();
}
