/**
 * UnreadBadge Component
 *
 * Displays unread count with polling updates.
 */

import React from 'react';
import { Label } from '@gravity-ui/uikit';
import { useUnreadCount } from '../../../hooks/useActivity';

export interface UnreadBadgeProps {
  size?: 'xs' | 's' | 'm';
  className?: string;
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  size = 's',
  className,
}) => {
  const { count, isLoading } = useUnreadCount();

  if (isLoading || count === 0) {
    return null;
  }

  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <Label theme="danger" size={size} className={className}>
      {displayCount}
    </Label>
  );
};

/**
 * UnreadDot Component
 *
 * Simple dot indicator for unread items.
 */
export const UnreadDot: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { count } = useUnreadCount();

  if (count === 0) {
    return null;
  }

  return (
    <span
      className={`inline-block w-2 h-2 bg-red-500 rounded-full ${className ?? ''}`}
      aria-label={`${count} unread items`}
    />
  );
};
