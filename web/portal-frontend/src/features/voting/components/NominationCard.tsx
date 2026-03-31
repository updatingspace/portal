/**
 * NominationCard Component
 * 
 * Displays a single nomination option with voting controls.
 * Supports single-choice (radio), multi-choice (checkbox), and ranked-choice modes.
 * 
 * Features:
 * - Visual modes: Radio/Checkbox/Rank
 * - Vote count visualization (progress bar)
 * - Selected state with visual confirmation
 * - Disabled state for closed votings
 * - Optimistic feedback on vote
 * - Progressive disclosure (compact → expanded → modal)
 * - WCAG 2.1 AA accessibility
 */

import React, { useState } from 'react';
import { Card, Button, Progress, Icon, Label } from '@gravity-ui/uikit';
import { Check, ChevronDown, ChevronUp } from '@gravity-ui/icons';
import type { Nomination } from '../unified';

// ============================================================================
// Types
// ============================================================================

export type VotingMode = 'single' | 'multi' | 'ranked';

export interface NominationCardProps {
  nomination: Nomination;
  mode: VotingMode;
  isSelected?: boolean;
  isVoted?: boolean;
  isDisabled?: boolean;
  showVoteCount?: boolean;
  totalVotes?: number;
  rank?: number; // For ranked voting
  onSelect?: (id: string) => void;
  onDeselect?: (id: string) => void;
  onExpand?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const NominationCard: React.FC<NominationCardProps> = ({
  nomination,
  mode,
  isSelected = false,
  isVoted = false,
  isDisabled = false,
  showVoteCount = false,
  totalVotes = 0,
  rank,
  onSelect,
  onDeselect,
  onExpand,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate vote percentage
  const votePercentage = totalVotes > 0 && nomination.vote_count
    ? (nomination.vote_count / totalVotes) * 100
    : 0;
  
  // Handle selection toggle
  const handleToggle = () => {
    if (isDisabled) return;
    
    if (isSelected) {
      onDeselect?.(nomination.id);
    } else {
      onSelect?.(nomination.id);
    }
  };
  
  // Handle keyboard
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isDisabled) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };
  
  // Handle expand
  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      onExpand?.(nomination.id);
    }
  };
  
  // Truncate description
  const truncatedDescription = nomination.description && nomination.description.length > 120
    ? `${nomination.description.slice(0, 120)}…`
    : nomination.description;
  
  // Has extended content
  const hasExtendedContent = nomination.description && nomination.description.length > 120;
  
  // Mode-specific props
  const roleAttr = mode === 'single' ? 'radio' : 'checkbox';
  const ariaChecked = isSelected;
  
  // Classes
  const selectedClass = isSelected ? 'nomination-card--selected' : '';
  const disabledClass = isDisabled ? 'nomination-card--disabled' : '';
  const votedClass = isVoted ? 'nomination-card--voted' : '';
  const expandedClass = isExpanded ? 'nomination-card--expanded' : '';
  
  return (
    <Card
      className={`nomination-card ${selectedClass} ${disabledClass} ${votedClass} ${expandedClass} ${className}`}
      role={roleAttr}
      aria-checked={ariaChecked}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="nomination-card__header">
        {/* Selection Control */}
        <div className="nomination-card__control">
          {mode === 'single' && (
            <div
              className={`nomination-card__radio ${isSelected ? 'nomination-card__radio--checked' : ''}`}
              aria-hidden="true"
            >
              {isSelected && <Icon data={Check} size={16} />}
            </div>
          )}
          
          {mode === 'multi' && (
            <div
              className={`nomination-card__checkbox ${isSelected ? 'nomination-card__checkbox--checked' : ''}`}
              aria-hidden="true"
            >
              {isSelected && <Icon data={Check} size={16} />}
            </div>
          )}
          
          {mode === 'ranked' && rank !== undefined && (
            <div className="nomination-card__rank" aria-label={`Позиция ${rank}`}>
              {rank}
            </div>
          )}
        </div>
        
        {/* Image */}
        {nomination.image_url && (
          <div className="nomination-card__image-wrapper">
            <img
              src={nomination.image_url}
              alt={nomination.title}
              className="nomination-card__image"
              loading="lazy"
            />
          </div>
        )}
        
        {/* Title & Meta */}
        <div className="nomination-card__title-block">
          <h3 className="nomination-card__title">
            {nomination.title}
          </h3>
          
          {/* Vote Count Badge */}
          {showVoteCount && nomination.vote_count !== undefined && (
            <Label theme="info" size="xs" className="nomination-card__vote-badge">
              {nomination.vote_count} {getVoteLabel(nomination.vote_count)}
            </Label>
          )}
        </div>
        
        {/* Expand Toggle */}
        {hasExtendedContent && (
          <Button
            view="flat"
            size="s"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              handleExpandToggle();
            }}
            className="nomination-card__expand-btn"
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            aria-expanded={isExpanded}
          >
            <Icon data={isExpanded ? ChevronUp : ChevronDown} size={16} />
          </Button>
        )}
      </div>
      
      {/* Body */}
      {nomination.description && (
        <div className="nomination-card__body">
          <p className="nomination-card__description">
            {isExpanded ? nomination.description : truncatedDescription}
          </p>
        </div>
      )}
      
      {/* Vote Progress Bar */}
      {showVoteCount && totalVotes > 0 && (
        <div className="nomination-card__progress">
          <Progress
            value={votePercentage}
            theme={isSelected ? 'success' : 'info'}
            size="xs"
            aria-label={`${votePercentage.toFixed(1)}% голосов`}
          />
          <span className="nomination-card__progress-label">
            {votePercentage.toFixed(1)}%
          </span>
        </div>
      )}
      
      {/* Selected Indicator */}
      {isSelected && (
        <div className="nomination-card__selected-indicator" aria-hidden="true">
          <Icon data={Check} size={20} />
          <span>Выбрано</span>
        </div>
      )}
      
      {/* Voted Indicator */}
      {isVoted && !isSelected && (
        <div className="nomination-card__voted-indicator" aria-hidden="true">
          <span>Проголосовано ранее</span>
        </div>
      )}
    </Card>
  );
};

/**
 * Get vote count label (Russian plural forms)
 */
function getVoteLabel(count: number): string {
  if (count % 10 === 1 && count !== 11) return 'голос';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count)) return 'голоса';
  return 'голосов';
}

// ============================================================================
// Skeleton
// ============================================================================

export const NominationCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <Card className={`nomination-card nomination-card-skeleton ${className}`}>
      <div className="nomination-card__header">
        <div className="skeleton-box skeleton-box--circle" />
        <div className="skeleton-box skeleton-box--image" />
        <div className="nomination-card__title-block">
          <div className="skeleton-box skeleton-box--line skeleton-box--wide" />
        </div>
      </div>
      <div className="nomination-card__body">
        <div className="skeleton-box skeleton-box--line" />
        <div className="skeleton-box skeleton-box--line skeleton-box--short" />
      </div>
    </Card>
  );
};

// ============================================================================
// Export
// ============================================================================

export default NominationCard;
