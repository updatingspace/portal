/**
 * Events API - Feature-level wrapper
 * 
 * This module provides type-safe access to events API functions
 * and should be used as the source of truth for event operations
 */

// Direct import from root API module (features/events is in src/features/)
// ../.. goes to src/, then /api/events
import * as eventsApi from '../../../api/events';

// Re-export all functions and types
export const fetchEvents = eventsApi.fetchEvents;
export const fetchEvent = eventsApi.fetchEvent;
export const createEvent = eventsApi.createEvent;
export const updateEvent = eventsApi.updateEvent;
export const setRsvp = eventsApi.setRsvp;
export const markAttendance = eventsApi.markAttendance;
export const exportEventAsIcs = eventsApi.exportEventAsIcs;

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
} from '../../../api/events';
