/**
 * Performance Utilities for Voting Feature
 * 
 * Prefetching, lazy loading, and performance optimizations
 * following best practices for React + TanStack Query.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { votingKeysUnified } from '../hooks/useVotingUnified';
import { fetchVotingSessionDetail, fetchNomination } from '../api/unifiedApi';

// ============================================================================
// Prefetch Hooks
// ============================================================================

/**
 * Prefetch voting session on hover
 * Reduces perceived latency when user navigates to detail page
 */
export function usePrefetchVotingSession() {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback((sessionId: string) => {
    // Skip if already prefetched recently
    if (prefetchedRef.current.has(sessionId)) {
      return;
    }

    prefetchedRef.current.add(sessionId);

    // Clear from set after 5 minutes to allow re-prefetch
    setTimeout(() => {
      prefetchedRef.current.delete(sessionId);
    }, 5 * 60 * 1000);

    queryClient.prefetchQuery({
      queryKey: votingKeysUnified.sessionDetail(sessionId),
      queryFn: () => fetchVotingSessionDetail(sessionId),
      staleTime: 60 * 1000, // 1 minute
    });
  }, [queryClient]);

  return prefetch;
}

/**
 * Prefetch nomination detail on hover
 */
export function usePrefetchNomination() {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback((nominationId: string) => {
    if (prefetchedRef.current.has(nominationId)) {
      return;
    }

    prefetchedRef.current.add(nominationId);

    setTimeout(() => {
      prefetchedRef.current.delete(nominationId);
    }, 5 * 60 * 1000);

    queryClient.prefetchQuery({
      queryKey: votingKeysUnified.nomination(nominationId),
      queryFn: () => fetchNomination(nominationId),
      staleTime: 60 * 1000,
    });
  }, [queryClient]);

  return prefetch;
}

/**
 * Prefetch on viewport visibility (Intersection Observer)
 */
export function usePrefetchOnVisible(
  prefetchFn: (id: string) => void,
  id: string,
  options: {
    rootMargin?: string;
    threshold?: number;
    enabled?: boolean;
  } = {},
) {
  const {
    rootMargin = '100px',
    threshold = 0,
    enabled = true,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (!enabled || hasPrefetched.current) return;

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPrefetched.current) {
            hasPrefetched.current = true;
            prefetchFn(id);
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [id, prefetchFn, rootMargin, threshold, enabled]);

  return elementRef;
}

// ============================================================================
// Debounce & Throttle
// ============================================================================

/**
 * Debounce hook for search/filter inputs
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle function for scroll handlers
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - (now - lastCall));
    }
  };
}

// ============================================================================
// Lazy Loading
// ============================================================================

import { lazy, Suspense, useState, type ComponentType } from 'react';

/**
 * Create lazy component with loading fallback
 */
export function lazyWithFallback<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  Fallback: React.FC = () => null,
) {
  const LazyComponent = lazy(importFn);

  return function LazyWithFallback(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<Fallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Lazy load heavy components (charts, visualizations)
 */
export const LazyResultsVisualization = lazyWithFallback(
  () => import('../components/ResultsVisualization'),
);

// ============================================================================
// Virtual Scrolling Support
// ============================================================================

/**
 * Calculate visible items for virtual list
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3,
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const end = Math.min(totalItems - 1, start + visibleCount + overscan * 2);

  return { start, end };
}

/**
 * Hook for simple virtual scrolling
 */
export function useVirtualScroll<T>(
  items: T[],
  options: {
    containerHeight: number;
    itemHeight: number;
    overscan?: number;
  },
) {
  const { containerHeight, itemHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const { start, end } = calculateVisibleRange(
    scrollTop,
    containerHeight,
    itemHeight,
    items.length,
    overscan,
  );

  const visibleItems = items.slice(start, end + 1);
  const totalHeight = items.length * itemHeight;
  const offsetTop = start * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetTop,
    handleScroll,
    startIndex: start,
    endIndex: end,
  };
}

// ============================================================================
// Image Loading
// ============================================================================

/**
 * Preload image and return loading state
 */
export function useImagePreload(src: string | undefined): {
  isLoaded: boolean;
  isError: boolean;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoaded(false);
      setIsError(false);
      return;
    }

    setIsLoaded(false);
    setIsError(false);

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setIsError(true);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { isLoaded, isError };
}

/**
 * Progressive image loading (blur → sharp)
 */
export function useProgressiveImage(
  lowResSrc: string | undefined,
  highResSrc: string | undefined,
): { src: string | undefined; isBlurred: boolean } {
  const [src, setSrc] = useState(lowResSrc);
  const [isBlurred, setIsBlurred] = useState(true);

  useEffect(() => {
    if (!highResSrc) return;

    const img = new Image();
    img.onload = () => {
      setSrc(highResSrc);
      setIsBlurred(false);
    };
    img.src = highResSrc;

    return () => {
      img.onload = null;
    };
  }, [highResSrc]);

  return { src, isBlurred };
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Measure component render time (development only)
 */
export function useRenderTime(componentName: string) {
  const startTime = useRef(performance.now());

  useEffect(() => {
    if (import.meta.env.MODE !== 'development') return;

    const endTime = performance.now();
    const duration = endTime - startTime.current;

    if (duration > 16) {
      // Longer than one frame (60fps)
      console.warn(`[Performance] ${componentName} render took ${duration.toFixed(2)}ms`);
    }
  });
}

/**
 * Track interaction timing
 */
export function trackInteraction(name: string, startTime: number) {
  if (import.meta.env.MODE !== 'development') return;

  const duration = performance.now() - startTime;
  console.log(`[Interaction] ${name}: ${duration.toFixed(2)}ms`);

  // Could send to analytics
  // analytics.track('interaction_timing', { name, duration });
}

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Cleanup old cache entries
 */
export function useQueryCacheCleanup(maxAge: number = 10 * 60 * 1000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const now = Date.now();

      queries.forEach((query) => {
        const age = now - (query.state.dataUpdatedAt || 0);
        if (age > maxAge && query.getObserversCount() === 0) {
          queryClient.removeQueries({ queryKey: query.queryKey });
        }
      });
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [queryClient, maxAge]);
}

// ============================================================================
// Export
// ============================================================================

export default {
  usePrefetchVotingSession,
  usePrefetchNomination,
  usePrefetchOnVisible,
  useDebounce,
  throttle,
  lazyWithFallback,
  LazyResultsVisualization,
  calculateVisibleRange,
  useVirtualScroll,
  useImagePreload,
  useProgressiveImage,
  useRenderTime,
  trackInteraction,
  useQueryCacheCleanup,
};
