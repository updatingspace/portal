/* eslint-disable react-refresh/only-export-components */
/**
 * Progressive Disclosure Component
 * 
 * Implements the UX pattern of progressive disclosure:
 * - Start with minimal information
 * - Reveal details on demand
 * - Reduce cognitive load
 * 
 * Based on Nielsen Norman Group's "Progressive Disclosure" principle.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Icon, Card, Modal } from '@gravity-ui/uikit';
import { ChevronDown, ChevronUp, Xmark } from '@gravity-ui/icons';

// ============================================================================
// Types
// ============================================================================

export type DisclosureLevel = 'compact' | 'expanded' | 'full';

export interface DisclosureState {
  level: DisclosureLevel;
  isAnimating: boolean;
}

// ============================================================================
// useProgressiveDisclosure Hook
// ============================================================================

export interface UseProgressiveDisclosureOptions {
  initialLevel?: DisclosureLevel;
  onLevelChange?: (level: DisclosureLevel) => void;
}

export function useProgressiveDisclosure(options: UseProgressiveDisclosureOptions = {}) {
  const { initialLevel = 'compact', onLevelChange } = options;
  
  const [level, setLevel] = useState<DisclosureLevel>(initialLevel);
  const [isAnimating, setIsAnimating] = useState(false);

  const expand = useCallback(() => {
    if (level === 'compact') {
      setIsAnimating(true);
      setLevel('expanded');
      onLevelChange?.('expanded');
    } else if (level === 'expanded') {
      setIsAnimating(true);
      setLevel('full');
      onLevelChange?.('full');
    }
  }, [level, onLevelChange]);

  const collapse = useCallback(() => {
    if (level === 'full') {
      setIsAnimating(true);
      setLevel('expanded');
      onLevelChange?.('expanded');
    } else if (level === 'expanded') {
      setIsAnimating(true);
      setLevel('compact');
      onLevelChange?.('compact');
    }
  }, [level, onLevelChange]);

  const toggle = useCallback(() => {
    if (level === 'compact') {
      expand();
    } else {
      collapse();
    }
  }, [level, expand, collapse]);

  const setLevelDirectly = useCallback((newLevel: DisclosureLevel) => {
    setIsAnimating(true);
    setLevel(newLevel);
    onLevelChange?.(newLevel);
  }, [onLevelChange]);

  // Reset animating flag after transition
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  return {
    level,
    isAnimating,
    isCompact: level === 'compact',
    isExpanded: level === 'expanded',
    isFull: level === 'full',
    expand,
    collapse,
    toggle,
    setLevel: setLevelDirectly,
  };
}

// ============================================================================
// ExpandableSection Component
// ============================================================================

export interface ExpandableSectionProps {
  /** Content always visible */
  summary: React.ReactNode;
  /** Content shown when expanded */
  details: React.ReactNode;
  /** Additional content for full view */
  fullContent?: React.ReactNode;
  /** Current disclosure level */
  level?: DisclosureLevel;
  /** Default level if uncontrolled */
  defaultLevel?: DisclosureLevel;
  /** Callback when level changes */
  onLevelChange?: (level: DisclosureLevel) => void;
  /** Show expand/collapse button */
  showToggle?: boolean;
  /** Custom toggle button label */
  toggleLabel?: {
    expand: string;
    collapse: string;
  };
  className?: string;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  summary,
  details,
  fullContent,
  level: controlledLevel,
  defaultLevel = 'compact',
  onLevelChange,
  showToggle = true,
  toggleLabel = {
    expand: 'Подробнее',
    collapse: 'Свернуть',
  },
  className = '',
}) => {
  const isControlled = controlledLevel !== undefined;
  const disclosure = useProgressiveDisclosure({
    initialLevel: isControlled ? controlledLevel : defaultLevel,
    onLevelChange,
  });

  const level = isControlled ? controlledLevel : disclosure.level;
  const isExpanded = level !== 'compact';

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  // Measure content height for animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [details, level]);

  const handleToggle = () => {
    if (isControlled) {
      onLevelChange?.(level === 'compact' ? 'expanded' : 'compact');
    } else {
      disclosure.toggle();
    }
  };

  return (
    <div className={`expandable-section ${className}`}>
      {/* Summary (always visible) */}
      <div className="expandable-section__summary">
        {summary}
      </div>

      {/* Details (expandable) */}
      <div
        ref={contentRef}
        className={`expandable-section__details ${isExpanded ? 'expandable-section__details--expanded' : ''}`}
        style={{
          maxHeight: isExpanded ? contentHeight : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
        }}
        aria-hidden={!isExpanded}
      >
        {details}
      </div>

      {/* Toggle button */}
      {showToggle && (
        <div className="expandable-section__toggle">
          <Button
            view="flat"
            size="s"
            onClick={handleToggle}
            aria-expanded={isExpanded}
          >
            <Icon data={isExpanded ? ChevronUp : ChevronDown} size={16} />
            <span>{isExpanded ? toggleLabel.collapse : toggleLabel.expand}</span>
          </Button>
        </div>
      )}

      {/* Full content modal */}
      {fullContent && level === 'full' && (
        <Modal
          open={level === 'full'}
          onOpenChange={(open) => {
            if (!open) {
              if (isControlled) {
                onLevelChange?.('expanded');
              } else {
                disclosure.collapse();
              }
            }
          }}
        >
          <div className="expandable-section__modal">
            {fullContent}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================================
// OptionDetailView Component (for NominationCard)
// ============================================================================

export interface OptionDetailViewProps {
  option: {
    id: string;
    title: string;
    description?: string;
    image_url?: string;
    vote_count?: number;
  };
  level: DisclosureLevel;
  onLevelChange: (level: DisclosureLevel) => void;
  showVoteCount?: boolean;
  totalVotes?: number;
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect?: () => void;
}

export const OptionDetailView: React.FC<OptionDetailViewProps> = ({
  option,
  level,
  onLevelChange,
  showVoteCount = false,
  totalVotes = 0,
  isSelected = false,
  isDisabled = false,
  onSelect,
}) => {
  const percentage = totalVotes > 0 && option.vote_count
    ? ((option.vote_count / totalVotes) * 100).toFixed(1)
    : '0';

  // Compact view: Title only
  if (level === 'compact') {
    return (
      <div
        className={`option-detail option-detail--compact ${isSelected ? 'option-detail--selected' : ''}`}
        onClick={!isDisabled ? onSelect : undefined}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect?.();
          }
        }}
      >
        <span className="option-detail__title">{option.title}</span>
        {showVoteCount && option.vote_count !== undefined && (
          <span className="option-detail__count">{option.vote_count}</span>
        )}
        <Button
          view="flat"
          size="xs"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onLevelChange('expanded');
          }}
        >
          <Icon data={ChevronDown} size={14} />
        </Button>
      </div>
    );
  }

  // Expanded view: Title + Description + Stats
  if (level === 'expanded') {
    return (
      <Card
        className={`option-detail option-detail--expanded ${isSelected ? 'option-detail--selected' : ''}`}
      >
        <div className="option-detail__header">
          {option.image_url && (
            <img
              src={option.image_url}
              alt={option.title}
              className="option-detail__image"
              loading="lazy"
            />
          )}
          <div className="option-detail__info">
            <h4 className="option-detail__title">{option.title}</h4>
            {option.description && (
              <p className="option-detail__description">
                {option.description.length > 150
                  ? `${option.description.slice(0, 150)}...`
                  : option.description}
              </p>
            )}
          </div>
        </div>

        {showVoteCount && (
          <div className="option-detail__stats">
            <span>{option.vote_count ?? 0} голосов</span>
            <span>{percentage}%</span>
          </div>
        )}

        <div className="option-detail__actions">
          <Button
            view={isSelected ? 'action' : 'outlined'}
            disabled={isDisabled}
            onClick={onSelect}
          >
            {isSelected ? 'Выбрано' : 'Выбрать'}
          </Button>
          {option.description && option.description.length > 150 && (
            <Button
              view="flat"
              onClick={() => onLevelChange('full')}
            >
              Читать полностью
            </Button>
          )}
          <Button
            view="flat"
            size="s"
            onClick={() => onLevelChange('compact')}
          >
            <Icon data={ChevronUp} size={14} />
          </Button>
        </div>
      </Card>
    );
  }

  // Full view: Modal with all details
  return (
    <Modal
      open={level === 'full'}
      onOpenChange={(open) => {
        if (!open) onLevelChange('expanded');
      }}
    >
      <div className="option-detail option-detail--full">
        <div className="option-detail__modal-header">
          <h3>{option.title}</h3>
          <Button
            view="flat"
            size="s"
            onClick={() => onLevelChange('expanded')}
          >
            <Icon data={Xmark} size={20} />
          </Button>
        </div>

        {option.image_url && (
          <img
            src={option.image_url}
            alt={option.title}
            className="option-detail__modal-image"
          />
        )}

        {option.description && (
          <div className="option-detail__modal-description">
            {option.description}
          </div>
        )}

        {showVoteCount && (
          <div className="option-detail__modal-stats">
            <div>
              <span className="option-detail__stat-value">{option.vote_count ?? 0}</span>
              <span className="option-detail__stat-label">голосов</span>
            </div>
            <div>
              <span className="option-detail__stat-value">{percentage}%</span>
              <span className="option-detail__stat-label">от общего числа</span>
            </div>
          </div>
        )}

        <div className="option-detail__modal-actions">
          <Button
            view="action"
            size="l"
            disabled={isDisabled}
            onClick={() => {
              onSelect?.();
              onLevelChange('expanded');
            }}
          >
            {isSelected ? 'Выбрано ✓' : 'Выбрать этот вариант'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

export const progressiveDisclosureStyles = `
.expandable-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expandable-section__toggle {
  display: flex;
  justify-content: center;
}

.option-detail--compact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--g-color-base-generic-ultralight);
  cursor: pointer;
  transition: background 0.2s;
}

.option-detail--compact:hover {
  background: var(--g-color-base-generic-light);
}

.option-detail--compact.option-detail--selected {
  background: var(--g-color-base-brand-light);
  border: 2px solid var(--g-color-line-brand);
}

.option-detail__title {
  flex: 1;
  font-weight: 500;
}

.option-detail__count {
  font-size: 14px;
  color: var(--g-color-text-secondary);
}

.option-detail--expanded {
  padding: 16px;
}

.option-detail__header {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.option-detail__image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}

.option-detail__info {
  flex: 1;
}

.option-detail__description {
  font-size: 14px;
  color: var(--g-color-text-secondary);
  margin: 8px 0 0;
}

.option-detail__stats {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid var(--g-color-line-generic);
  font-size: 14px;
  color: var(--g-color-text-secondary);
}

.option-detail__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.option-detail--full {
  padding: 24px;
  max-width: 600px;
}

.option-detail__modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.option-detail__modal-image {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 20px;
}

.option-detail__modal-description {
  line-height: 1.6;
  margin-bottom: 20px;
}

.option-detail__modal-stats {
  display: flex;
  gap: 32px;
  padding: 20px;
  background: var(--g-color-base-generic-ultralight);
  border-radius: 8px;
  margin-bottom: 20px;
}

.option-detail__stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
}

.option-detail__stat-label {
  font-size: 13px;
  color: var(--g-color-text-secondary);
}

.option-detail__modal-actions {
  display: flex;
  justify-content: center;
}
`;

// ============================================================================
// Export
// ============================================================================

export default {
  useProgressiveDisclosure,
  ExpandableSection,
  OptionDetailView,
};
