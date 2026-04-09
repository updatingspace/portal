/**
 * VotingCard Component
 * 
 * Displays voting session summary in catalog/list views.
 * Supports both legacy and modern voting types through unified API.
 * 
 * Features:
 * - Visual hierarchy (active > upcoming > finished)
 * - Countdown timer for active votings
 * - Progress indicator (participated/total)
 * - Skeleton loading variant
 * - WCAG 2.1 AA accessibility
 * - Keyboard navigation
 */

import React, { useMemo } from 'react';
import { Button, Progress } from '@gravity-ui/uikit';
import type { VotingSession } from '../unified';
import { isLegacyPoll } from '../unified';
import { formatDate } from '@/shared/lib/formatters';

// ============================================================================
// Types
// ============================================================================

export interface VotingCardProps {
  voting: VotingSession;
  variant?: 'large' | 'medium' | 'small';
  showProgress?: boolean;
  onClick?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format deadline for display
 */
function formatDeadline(endsAt?: string | null): string {
  if (!endsAt) return 'Без срока';
  
  const deadline = new Date(endsAt);
  if (Number.isNaN(deadline.getTime())) return 'Без срока';

  return formatDate(deadline);
}

/**
 * Calculate time remaining until deadline
 */
function getTimeRemaining(endsAt?: string | null): {
  label: string;
  percentage: number;
  isUrgent: boolean;
} | null {
  if (!endsAt) return null;
  
  const deadline = new Date(endsAt);
  if (Number.isNaN(deadline.getTime())) return null;
  
  const now = Date.now();
  const end = deadline.getTime();
  const remaining = end - now;
  
  if (remaining <= 0) {
    return { label: 'Завершено', percentage: 100, isUrgent: false };
  }
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  let label: string;
  if (days > 0) {
    label = `${days} ${getDayLabel(days)}`;
  } else if (hours > 0) {
    label = `${hours} ${getHourLabel(hours)}`;
  } else {
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    label = `${minutes} ${getMinuteLabel(minutes)}`;
  }
  
  // Calculate percentage (assuming 30 days max duration for visualization)
  const maxDuration = 30 * 24 * 60 * 60 * 1000;
  const percentage = Math.min(100, ((maxDuration - remaining) / maxDuration) * 100);
  
  const isUrgent = remaining < 24 * 60 * 60 * 1000; // Less than 24 hours
  
  return { label, percentage, isUrgent };
}

function getDayLabel(days: number): string {
  if (days % 10 === 1 && days !== 11) return 'день';
  if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days)) return 'дня';
  return 'дней';
}

function getHourLabel(hours: number): string {
  if (hours % 10 === 1 && hours !== 11) return 'час';
  if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours)) return 'часа';
  return 'часов';
}

function getMinuteLabel(minutes: number): string {
  if (minutes % 10 === 1 && minutes !== 11) return 'минута';
  if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes)) return 'минуты';
  return 'минут';
}

/**
 * Get status display properties
 */
function getStatusProps(status: string): {
  label: string;
  theme: 'success' | 'info' | 'normal' | 'warning' | 'danger';
} {
  switch (status) {
    case 'active':
      return { label: 'Активно', theme: 'success' };
    case 'draft':
      return { label: 'Черновик', theme: 'info' };
    case 'closed':
      return { label: 'Завершено', theme: 'normal' };
    default:
      return { label: 'Архив', theme: 'normal' };
  }
}

/**
 * Get accent gradient colors
 */
const accentPalettes = [
  ['#667eea', '#764ba2'], // Purple-blue
  ['#f093fb', '#f5576c'], // Pink-red
  ['#4facfe', '#00f2fe'], // Blue-cyan
  ['#43e97b', '#38f9d7'], // Green-teal
  ['#fa709a', '#fee140'], // Pink-yellow
  ['#30cfd0', '#330867'], // Cyan-purple
  ['#a8edea', '#fed6e3'], // Teal-pink
  ['#ff9a9e', '#fecfef'], // Rose-pink
];

// ============================================================================
// Component
// ============================================================================

export const VotingCard: React.FC<VotingCardProps> = ({
  voting,
  variant = 'medium',
  showProgress = true,
  onClick,
  className = '',
}) => {
  // Extract data (handle legacy vs modern)
  const title = voting.title;
  const description = voting.description ?? 'Описание голосования';
  const status = voting.status;
  const endsAt = voting.ends_at;
  
  // Legacy-specific fields
  const nominationCount = isLegacyPoll(voting) ? voting.nominationCount : 0;
  const imageUrl = isLegacyPoll(voting) ? voting.imageUrl : null;
  
  // Status props
  const statusProps = getStatusProps(status);
  
  // Time remaining
  const timeRemaining = useMemo(() => getTimeRemaining(endsAt), [endsAt]);
  
  // Gradient palette (deterministic based on voting ID)
  const palette = useMemo(() => {
    const hash = voting.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return accentPalettes[hash % accentPalettes.length];
  }, [voting.id]);
  
  // Truncate description
  const truncatedDescription = useMemo(() => {
    if (!description) return 'Описание голосования';
    const maxLength = variant === 'large' ? 200 : variant === 'medium' ? 140 : 80;
    return description.length > maxLength
      ? `${description.slice(0, maxLength)}…`
      : description;
  }, [description, variant]);
  
  // Deadline label
  const deadlineLabel = formatDeadline(endsAt);
  
  // Handle click
  const handleClick = () => {
    onClick?.(voting.id);
  };
  
  // Handle keyboard
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };
  
  // Variant classes
  const variantClass = `voting-card--${variant}`;
  const statusClass = `voting-card--${status}`;
  const urgentClass = timeRemaining?.isUrgent ? 'voting-card--urgent' : '';
  
  return (
    <article
      className={`voting-card ${variantClass} ${statusClass} ${urgentClass} ${className}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-labelledby={`voting-${voting.id}-title`}
      aria-describedby={`voting-${voting.id}-meta`}
    >
      {/* Cover Image / Gradient */}
      <div
        className="voting-card__cover"
        style={{
          background: imageUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%), url(${imageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
        }}
        aria-hidden="true"
      >
        {/* Status Badge */}
        <div className="voting-card__cover-top">
          <span className={`voting-card__status voting-card__status--${statusProps.theme}`}>
            {statusProps.label}
          </span>
          
          {/* Deadline Tag */}
          {timeRemaining && (
            <span className="voting-card__deadline-tag">
              {status === 'active' ? 'до' : 'финиш'} · {deadlineLabel}
            </span>
          )}
        </div>
        
        {/* Title */}
        <div
          id={`voting-${voting.id}-title`}
          className="voting-card__cover-title"
        >
          {title}
        </div>
      </div>
      
      {/* Body */}
      <div className="voting-card__body">
        {/* Description */}
        <p className="voting-card__description">
          {truncatedDescription}
        </p>
        
        {/* Meta Info */}
        <div
          id={`voting-${voting.id}-meta`}
          className="voting-card__meta"
        >
          {nominationCount > 0 && (
            <span className="voting-card__meta-item">
              📊 {nominationCount} {getNominationLabel(nominationCount)}
            </span>
          )}
        </div>
        
        {/* Progress Bar (Time Remaining) */}
        {showProgress && timeRemaining && status === 'active' && (
          <div className="voting-card__progress">
            <div className="voting-card__progress-label">
              <span>Осталось: {timeRemaining.label}</span>
              {timeRemaining.isUrgent && (
                <span className="voting-card__urgent-badge">⏰ Заканчивается</span>
              )}
            </div>
            <Progress
              value={timeRemaining.percentage}
              theme={timeRemaining.isUrgent ? 'danger' : 'success'}
              size="s"
              aria-label={`Прогресс голосования: ${timeRemaining.percentage.toFixed(0)}%`}
            />
          </div>
        )}
        
        {/* Footer (CTA Button) */}
        <div className="voting-card__footer">
          <Button
            view={status === 'active' ? 'outlined' : 'flat-secondary'}
            size={variant === 'large' ? 'm' : 's'}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              handleClick();
            }}
            aria-label={`Открыть голосование: ${title}`}
          >
            {status === 'active' ? 'Голосовать' : 'Посмотреть'}
          </Button>
        </div>
      </div>
    </article>
  );
};

/**
 * Get nomination count label (Russian plural forms)
 */
function getNominationLabel(count: number): string {
  if (count % 10 === 1 && count !== 11) return 'номинация';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count)) return 'номинации';
  return 'номинаций';
}

// ============================================================================
// Export
// ============================================================================

export default VotingCard;
