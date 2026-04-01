/**
 * Hook for modal analytics
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import {
  trackEvent,
  fetchModalAnalytics,
  fetchAnalyticsReport,
} from '../api/contentApi';
import type { AnalyticsEventType, AnalyticsReport, ModalAnalytics } from '../types';

const ANALYTICS_QUERY_KEY = 'modal-analytics';

/**
 * Generate or retrieve session ID for analytics
 */
function getSessionId(): string {
  const key = 'updspace_session_id';
  let sessionId = sessionStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}

/**
 * Hook for tracking modal analytics events
 */
export function useModalTracking() {
  const trackedViews = useRef<Set<number>>(new Set());

  const trackMutation = useMutation({
    mutationFn: trackEvent,
  });

  /**
   * Track a modal view (only once per session per modal)
   */
  const trackView = useCallback(
    (modalId: number) => {
      if (trackedViews.current.has(modalId)) {
        return; // Already tracked this session
      }

      trackedViews.current.add(modalId);
      trackMutation.mutate({
        modalId,
        eventType: 'view',
        sessionId: getSessionId(),
      });
    },
    [trackMutation]
  );

  /**
   * Track a modal button click
   */
  const trackClick = useCallback(
    (modalId: number, metadata?: Record<string, unknown>) => {
      trackMutation.mutate({
        modalId,
        eventType: 'click',
        sessionId: getSessionId(),
        metadata,
      });
    },
    [trackMutation]
  );

  /**
   * Track a modal dismiss (close without clicking button)
   */
  const trackDismiss = useCallback(
    (modalId: number, metadata?: Record<string, unknown>) => {
      trackMutation.mutate({
        modalId,
        eventType: 'dismiss',
        sessionId: getSessionId(),
        metadata,
      });
    },
    [trackMutation]
  );

  /**
   * Generic track function
   */
  const track = useCallback(
    (
      modalId: number,
      eventType: AnalyticsEventType,
      metadata?: Record<string, unknown>
    ) => {
      if (eventType === 'view') {
        trackView(modalId);
      } else {
        trackMutation.mutate({
          modalId,
          eventType,
          sessionId: getSessionId(),
          metadata,
        });
      }
    },
    [trackMutation, trackView]
  );

  return {
    trackView,
    trackClick,
    trackDismiss,
    track,
    isTracking: trackMutation.isPending,
  };
}

/**
 * Hook for fetching modal analytics (admin)
 */
export function useModalAnalytics(days: number = 30) {
  const {
    data: analytics = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ModalAnalytics[]>({
    queryKey: [ANALYTICS_QUERY_KEY, 'modals', days],
    queryFn: () => fetchModalAnalytics(days),
  });

  // Sort helpers
  const sortedByViews = [...analytics].sort(
    (a, b) => b.total_views - a.total_views
  );

  const sortedByCtr = [...analytics].sort(
    (a, b) => b.click_through_rate - a.click_through_rate
  );

  const topPerformers = sortedByCtr.slice(0, 5);
  const mostViewed = sortedByViews.slice(0, 5);

  return {
    analytics,
    sortedByViews,
    sortedByCtr,
    topPerformers,
    mostViewed,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching analytics report (admin dashboard)
 */
export function useAnalyticsReport(days: number = 30) {
  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useQuery<AnalyticsReport>({
    queryKey: [ANALYTICS_QUERY_KEY, 'report', days],
    queryFn: () => fetchAnalyticsReport(days),
  });

  return {
    report,
    isLoading,
    error,
    refetch,
  };
}
