/**
 * Accessibility Utilities for Voting Components
 * 
 * WCAG 2.1 AA compliant helpers for keyboard navigation,
 * screen reader announcements, and focus management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Constants
// ============================================================================

/**
 * Common ARIA live region politeness levels
 */
export const AriaLive = {
  POLITE: 'polite' as const,
  ASSERTIVE: 'assertive' as const,
  OFF: 'off' as const,
};

/**
 * Keyboard key codes for navigation
 */
export const Keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing focus within a container (focus trap)
 * Used for modals, dialogs, and dropdown menus
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in container
    const container = containerRef.current;
    if (container) {
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }

    return () => {
      // Restore focus on unmount
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isActive || event.key !== Keys.TAB) return;

    const container = containerRef.current;
    if (!container) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    // Trap focus within container
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [isActive]);

  return { containerRef, handleKeyDown };
}

/**
 * Hook for roving tabindex pattern
 * Used for radio groups, option lists, and toolbars
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: readonly { id: string }[],
  initialIndex: number = 0,
) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const itemRefs = useRef<Map<string, T>>(new Map());

  const setItemRef = useCallback((id: string) => (element: T | null) => {
    if (element) {
      itemRefs.current.set(id, element);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  const focusItem = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    setActiveIndex(clampedIndex);
    
    const item = items[clampedIndex];
    if (item) {
      const element = itemRefs.current.get(item.id);
      element?.focus();
    }
  }, [items]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    let handled = true;

    switch (event.key) {
      case Keys.ARROW_DOWN:
      case Keys.ARROW_RIGHT:
        focusItem(activeIndex + 1);
        break;
      case Keys.ARROW_UP:
      case Keys.ARROW_LEFT:
        focusItem(activeIndex - 1);
        break;
      case Keys.HOME:
        focusItem(0);
        break;
      case Keys.END:
        focusItem(items.length - 1);
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  }, [activeIndex, items.length, focusItem]);

  const getTabIndex = useCallback((index: number) => {
    return index === activeIndex ? 0 : -1;
  }, [activeIndex]);

  return {
    activeIndex,
    setActiveIndex,
    setItemRef,
    handleKeyDown,
    getTabIndex,
    focusItem,
  };
}

/**
 * Hook for announcing messages to screen readers
 */
export function useAnnounce() {
  const [announcement, setAnnouncement] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback((message: string, level: 'polite' | 'assertive' = 'polite') => {
    setPoliteness(level);
    // Clear and re-set to ensure announcement is made
    setAnnouncement('');
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  // Component to render live region
  const LiveRegion = useCallback(() => (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  ), [announcement, politeness]);

  return { announce, announcePolite, announceAssertive, LiveRegion };
}

/**
 * Hook for reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}

/**
 * Hook for high contrast mode detection
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-contrast: more)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Check if element is visible (not hidden by CSS)
 */
export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * Generate unique ID for ARIA attributes
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Create descriptive label for screen readers
 */
export function createVotingAriaLabel(
  title: string,
  status: string,
  deadline?: string | null,
  voteCount?: number,
): string {
  const parts = [title, status];
  
  if (deadline) {
    parts.push(`срок до ${deadline}`);
  }
  
  if (voteCount !== undefined) {
    parts.push(`${voteCount} ${getVotePluralForm(voteCount)}`);
  }
  
  return parts.join(', ');
}

/**
 * Get Russian plural form for vote count
 */
function getVotePluralForm(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return 'голос';
  }
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return 'голоса';
  }
  return 'голосов';
}

/**
 * Format time for screen readers (more descriptive)
 */
export function formatTimeForScreenReader(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Create progress description for screen readers
 */
export function createProgressAriaLabel(
  percentage: number,
  label?: string,
): string {
  const roundedPercentage = Math.round(percentage);
  
  if (label) {
    return `${label}: ${roundedPercentage} процентов`;
  }
  
  return `${roundedPercentage} процентов`;
}

// ============================================================================
// ARIA Props Helpers
// ============================================================================

/**
 * Props for clickable card elements
 */
export interface ClickableCardAriaProps {
  role: 'button';
  tabIndex: 0;
  'aria-labelledby': string;
  'aria-describedby'?: string;
}

export function getClickableCardAriaProps(
  labelId: string,
  descriptionId?: string,
): ClickableCardAriaProps {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-labelledby': labelId,
    'aria-describedby': descriptionId,
  };
}

/**
 * Props for radio/checkbox option elements
 */
export interface OptionAriaProps {
  role: 'radio' | 'checkbox';
  'aria-checked': boolean;
  'aria-disabled'?: boolean;
  tabIndex: number;
}

export function getOptionAriaProps(
  mode: 'single' | 'multi',
  isSelected: boolean,
  isDisabled: boolean,
  tabIndex: number,
): OptionAriaProps {
  return {
    role: mode === 'single' ? 'radio' : 'checkbox',
    'aria-checked': isSelected,
    'aria-disabled': isDisabled || undefined,
    tabIndex,
  };
}

/**
 * Props for loading skeleton elements
 */
export function getSkeletonAriaProps(label: string = 'Загрузка') {
  return {
    'aria-busy': true,
    'aria-label': label,
  };
}

/**
 * Props for alert elements
 */
export function getAlertAriaProps(isUrgent: boolean = false) {
  return {
    role: 'alert',
    'aria-live': isUrgent ? 'assertive' : 'polite',
    'aria-atomic': true,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  useFocusTrap,
  useRovingTabIndex,
  useAnnounce,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  getFocusableElements,
  isElementVisible,
  generateAriaId,
  createVotingAriaLabel,
  formatTimeForScreenReader,
  createProgressAriaLabel,
  getClickableCardAriaProps,
  getOptionAriaProps,
  getSkeletonAriaProps,
  getAlertAriaProps,
  AriaLive,
  Keys,
};
