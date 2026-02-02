/**
 * FeedItem Component
 *
 * Renders a single activity event in the feed.
 */

import React from 'react';
import { Card, Label } from '@gravity-ui/uikit';
import type { ActivityEvent } from '../../../types/activity';

// Event type configuration
const EVENT_CONFIG: Record<string, { icon: string; label: string; theme: 'info' | 'success' | 'warning' | 'danger' | 'normal' }> = {
  'vote.cast': { icon: '🗳️', label: 'Голосование', theme: 'info' },
  'event.created': { icon: '📅', label: 'Событие', theme: 'success' },
  'event.rsvp.changed': { icon: '✅', label: 'RSVP', theme: 'success' },
  'post.created': { icon: '📝', label: 'Пост', theme: 'normal' },
  'game.achievement': { icon: '🏆', label: 'Достижение', theme: 'warning' },
  'game.playtime': { icon: '🎮', label: 'Игра', theme: 'info' },
  'steam.private': { icon: '🔒', label: 'Steam', theme: 'normal' },
  'minecraft.session': { icon: '⛏️', label: 'Minecraft', theme: 'info' },
};

const getEventConfig = (type: string) => {
  if (EVENT_CONFIG[type]) return EVENT_CONFIG[type];
  
  // Fallback based on prefix
  if (type.startsWith('vote')) return { icon: '🗳️', label: 'Голосование', theme: 'info' as const };
  if (type.startsWith('event')) return { icon: '📅', label: 'Событие', theme: 'success' as const };
  if (type.startsWith('game') || type.startsWith('steam') || type.startsWith('minecraft')) {
    return { icon: '🎮', label: 'Игра', theme: 'info' as const };
  }
  return { icon: '📌', label: type, theme: 'normal' as const };
};

export interface FeedItemProps {
  item: ActivityEvent;
  showPayload?: boolean;
  compact?: boolean;
  onClick?: (item: ActivityEvent) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  item,
  showPayload = true,
  compact = false,
  onClick,
}) => {
  const config = getEventConfig(item.type);
  const dateStr = new Date(item.occurredAt).toLocaleString();

  const handleClick = () => {
    onClick?.(item);
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 py-2 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}
        onClick={handleClick}
      >
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium truncate block">{item.title}</span>
          <span className="text-xs text-gray-500">{dateStr}</span>
        </div>
        <Label theme={config.theme} size="xs">{config.label}</Label>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={onClick ? 'cursor-pointer' : ''}
    >
      <Card
        className="p-4 mb-3 hover:shadow-md transition-shadow"
      >
      <div className="flex items-start gap-4">
        <div className="text-2xl mt-1">{config.icon}</div>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>{dateStr}</span>
            <span>•</span>
            <Label theme={config.theme} size="xs">{config.label}</Label>
            {item.scopeType && (
              <>
                <span>•</span>
                <span className="text-xs">{item.scopeType}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-lg">{item.title}</h3>

          {/* Payload */}
          {showPayload && item.payloadJson && Object.keys(item.payloadJson).length > 0 && (
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(item.payloadJson, null, 2)}
              </pre>
            </div>
          )}

          {/* Source */}
          {item.sourceRef && (
            <div className="mt-1 text-xs text-gray-400">
              Source: {item.sourceRef}
            </div>
          )}
        </div>
      </div>
    </Card>
    </div>
  );
};
