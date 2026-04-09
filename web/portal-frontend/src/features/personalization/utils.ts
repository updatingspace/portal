/**
 * Utility functions for personalization feature
 */
import type { LabelProps } from '@gravity-ui/uikit';
import type { ModalType, WidgetType } from './types';
import { getLocale } from '@/shared/lib/locale';
import {
  formatDate as formatSharedDate,
  formatDateTime as formatSharedDateTime,
} from '@/shared/lib/formatters';

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return formatSharedDate(dateString);
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  return formatSharedDateTime(dateString);
}

/**
 * Get color theme for modal type label
 */
export function getModalTypeColor(
  modalType: ModalType
): LabelProps['theme'] {
  const colors: Record<ModalType, LabelProps['theme']> = {
    info: 'info',
    warning: 'warning',
    success: 'success',
    promo: 'utility',
  };
  return colors[modalType] || 'normal';
}

/**
 * Get display label for modal type
 */
export function getModalTypeLabel(modalType: ModalType): string {
  const isRu = getLocale() === 'ru';
  const labels: Record<ModalType, string> = isRu
    ? {
        info: 'Информация',
        warning: 'Предупреждение',
        success: 'Успех',
        promo: 'Промо',
      }
    : {
        info: 'Info',
        warning: 'Warning',
        success: 'Success',
        promo: 'Promo',
      };
  return labels[modalType] || modalType;
}

/**
 * Get color theme for widget type label
 */
export function getWidgetTypeColor(
  widgetType: WidgetType
): LabelProps['theme'] {
  const colors: Record<WidgetType, LabelProps['theme']> = {
    banner: 'info',
    announcement: 'warning',
    promotion: 'success',
    notification: 'normal',
  };
  return colors[widgetType] || 'normal';
}

/**
 * Get display label for widget type
 */
export function getWidgetTypeLabel(widgetType: WidgetType): string {
  const isRu = getLocale() === 'ru';
  const labels: Record<WidgetType, string> = isRu
    ? {
        banner: 'Баннер',
        announcement: 'Объявление',
        promotion: 'Промо',
        notification: 'Уведомление',
      }
    : {
        banner: 'Banner',
        announcement: 'Announcement',
        promotion: 'Promotion',
        notification: 'Notification',
      };
  return labels[widgetType] || widgetType;
}

/**
 * Check if a date range is currently active
 */
export function isDateRangeActive(
  startDate: string | null,
  endDate: string | null
): boolean {
  const now = new Date();

  if (startDate && new Date(startDate) > now) {
    return false;
  }

  if (endDate && new Date(endDate) < now) {
    return false;
  }

  return true;
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 0) {
    // Future
    const futureDays = Math.floor(-diffDays);
    const futureHours = Math.floor(-diffHours);
    const futureMins = Math.floor(-diffMins);

    if (futureDays > 0) return `in ${futureDays} day${futureDays > 1 ? 's' : ''}`;
    if (futureHours > 0) return `in ${futureHours} hour${futureHours > 1 ? 's' : ''}`;
    if (futureMins > 0) return `in ${futureMins} minute${futureMins > 1 ? 's' : ''}`;
    return 'just now';
  }

  // Past
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as object,
          sourceValue as object
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function objectKeysToCamel<T extends object>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? objectKeysToCamel(item)
        : item
    ) as T;
  }

  const result: Record<string, unknown> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const camelKey = snakeToCamel(key);

      if (typeof value === 'object' && value !== null) {
        result[camelKey] = objectKeysToCamel(value as object);
      } else {
        result[camelKey] = value;
      }
    }
  }

  return result as T;
}
