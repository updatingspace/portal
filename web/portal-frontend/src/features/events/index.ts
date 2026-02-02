/**
 * Events Feature - Public API
 *
 * Exports all types and API functions related to events management
 */

// ============================================================================
// Types
// ============================================================================

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
} from './types';

// ============================================================================
// API Functions
// ============================================================================

export {
  fetchEvents,
  fetchEvent,
  createEvent,
  updateEvent,
  setRsvp,
  markAttendance,
  exportEventAsIcs,
} from '../../api/events';

// ============================================================================
// Hooks
// ============================================================================

export {
  useEventsList,
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useSetRsvp,
  useMarkAttendance,
  useExportEventAsIcs,
  eventsQueryKeys,
} from './hooks';

// ============================================================================
// Components
// ============================================================================

export {
  EventForm,
  EventCard,
  EventRsvpCounts,
  type EventRsvpCountsProps,
} from './components';

// ============================================================================
// Pages
// ============================================================================

export {EventRsvpPage} from './pages';
