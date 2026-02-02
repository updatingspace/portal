import { request } from './client';
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
    const query = new URLSearchParams(
        Object.fromEntries(
            Object.entries(params || {}).map(([k, v]) => [k, String(v)])
        )
    ).toString();
    return request<EventListResponse>(`/events?${query}`);
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
