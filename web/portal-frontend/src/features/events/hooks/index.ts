/**
 * Events Hooks - TanStack Query integration
 * 
 * Provides reusable hooks for fetching and managing event data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchEvents,
    fetchEvent,
    createEvent,
    updateEvent,
    setRsvp,
    markAttendance,
    exportEventAsIcs,
} from '../api';
import type {
    EventListResponse,
    EventWithCounts,
    CreateEventPayload,
    UpdateEventPayload,
    RsvpStatus,
    FetchEventsParams,
} from '../types';

/**
 * Query keys for events
 */
export const eventsQueryKeys = {
    all: ['events'] as const,
    lists: () => [...eventsQueryKeys.all, 'list'] as const,
    list: (params?: FetchEventsParams) => [...eventsQueryKeys.lists(), { ...params }] as const,
    details: () => [...eventsQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...eventsQueryKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated list of events
 */
export function useEventsList(params?: FetchEventsParams) {
    return useQuery<EventListResponse>({
        queryKey: eventsQueryKeys.list(params),
        queryFn: () => fetchEvents(params),
    });
}

/**
 * Hook to fetch a single event by ID
 */
export function useEvent(id: string) {
    return useQuery<EventWithCounts>({
        queryKey: eventsQueryKeys.detail(id),
        queryFn: () => fetchEvent(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new event
 */
export function useCreateEvent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateEventPayload) => createEvent(data),
        onSuccess: (newEvent: EventWithCounts) => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({
                queryKey: eventsQueryKeys.lists(),
            });
            // Cache the new event
            queryClient.setQueryData(eventsQueryKeys.detail(newEvent.id), newEvent);
        },
    });
}

/**
 * Hook to update an existing event
 */
export function useUpdateEvent(eventId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateEventPayload) => updateEvent(eventId, data),
        onSuccess: (updatedEvent: EventWithCounts) => {
            // Update cache for this event
            queryClient.setQueryData(eventsQueryKeys.detail(eventId), updatedEvent);
            // Invalidate list queries
            queryClient.invalidateQueries({
                queryKey: eventsQueryKeys.lists(),
            });
        },
    });
}

/**
 * Hook to set user's RSVP status for an event
 */
export function useSetRsvp(eventId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (status: RsvpStatus) => setRsvp(eventId, status),
        onSuccess: () => {
            // Refetch the event to get updated RSVP counts and myRsvp
            queryClient.invalidateQueries({
                queryKey: eventsQueryKeys.detail(eventId),
            });
        },
    });
}

/**
 * Hook to mark attendance for a user at an event
 */
export function useMarkAttendance(eventId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => markAttendance(eventId, userId),
        onSuccess: () => {
            // Refetch the event
            queryClient.invalidateQueries({
                queryKey: eventsQueryKeys.detail(eventId),
            });
        },
    });
}

/**
 * Hook to export an event as ICS file
 */
export function useExportEventAsIcs() {
    return useMutation({
        mutationFn: async (eventId: string) => {
            const blob = await exportEventAsIcs(eventId);
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `event-${eventId}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
    });
}
