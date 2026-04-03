/**
 * Skeleton Components for Voting Feature
 * 
 * Consistent loading placeholders following Nielsen's heuristic:
 * "Visibility of system status" - users should always know what's happening.
 */

import React from 'react';

// ============================================================================
// Base Skeleton Component
// ============================================================================

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  className = '',
  animate = true,
}) => {
  return (
    <div
      className={`skeleton ${animate ? 'skeleton--animated' : ''} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
      aria-hidden="true"
    />
  );
};

// ============================================================================
// Text Skeleton
// ============================================================================

interface TextSkeletonProps {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 3,
  lastLineWidth = '70%',
  className = '',
}) => {
  return (
    <div className={`text-skeleton ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height={14}
          className="text-skeleton__line"
        />
      ))}
    </div>
  );
};

// ============================================================================
// VotingCard Skeleton
// ============================================================================

export interface VotingCardSkeletonProps {
  variant?: 'large' | 'medium' | 'small';
  className?: string;
}

export const VotingCardSkeleton: React.FC<VotingCardSkeletonProps> = ({
  variant = 'medium',
  className = '',
}) => {
  const heights = {
    large: 240,
    medium: 180,
    small: 120,
  };

  return (
    <article
      className={`voting-card voting-card--skeleton voting-card--${variant} ${className}`}
      aria-busy="true"
      aria-label="Загрузка голосования"
    >
      {/* Cover */}
      <div className="voting-card__cover skeleton--animated" style={{ height: heights[variant] }}>
        <div className="voting-card__cover-top">
          <Skeleton width={80} height={24} borderRadius={12} />
          <Skeleton width={100} height={20} borderRadius={10} />
        </div>
        <div className="voting-card__cover-title">
          <Skeleton width="80%" height={24} borderRadius={4} />
        </div>
      </div>

      {/* Body */}
      <div className="voting-card__body">
        <TextSkeleton lines={2} lastLineWidth="60%" />
        
        <div className="voting-card__meta">
          <Skeleton width={60} height={16} />
        </div>

        <div className="voting-card__footer">
          <Skeleton width={100} height={32} borderRadius={6} />
        </div>
      </div>
    </article>
  );
};

// ============================================================================
// VotingList Skeleton
// ============================================================================

export interface VotingListSkeletonProps {
  count?: number;
  variant?: 'large' | 'medium' | 'small';
  showFilters?: boolean;
  className?: string;
}

export const VotingListSkeleton: React.FC<VotingListSkeletonProps> = ({
  count = 6,
  variant = 'medium',
  showFilters = true,
  className = '',
}) => {
  return (
    <div className={`voting-list voting-list--skeleton ${className}`} aria-busy="true" aria-label="Загрузка списка голосований">
      {/* Filters skeleton */}
      {showFilters && (
        <div className="voting-list__toolbar">
          <div className="voting-list__filters">
            <Skeleton width={150} height={36} borderRadius={6} />
            <Skeleton width={150} height={36} borderRadius={6} />
          </div>
        </div>
      )}

      {/* Summary skeleton */}
      <div className="voting-list__summary">
        <Skeleton width={120} height={16} />
      </div>

      {/* Grid skeleton */}
      <div className="voting-list__grid">
        {Array.from({ length: count }).map((_, i) => (
          <VotingCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// NominationCard Skeleton
// ============================================================================

export interface NominationCardSkeletonProps {
  showImage?: boolean;
  className?: string;
}

export const NominationCardSkeleton: React.FC<NominationCardSkeletonProps> = ({
  showImage = true,
  className = '',
}) => {
  return (
    <div
      className={`nomination-card nomination-card--skeleton ${className}`}
      aria-busy="true"
      aria-label="Загрузка варианта"
    >
      <div className="nomination-card__header">
        {/* Radio/checkbox skeleton */}
        <Skeleton width={20} height={20} borderRadius="50%" />

        {/* Image skeleton */}
        {showImage && <Skeleton width={60} height={60} borderRadius={8} />}

        {/* Title skeleton */}
        <div className="nomination-card__title-block" style={{ flex: 1 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width={50} height={16} borderRadius={8} />
        </div>
      </div>

      {/* Description skeleton */}
      <div className="nomination-card__body">
        <TextSkeleton lines={2} lastLineWidth="50%" />
      </div>
    </div>
  );
};

// ============================================================================
// NominationList Skeleton
// ============================================================================

export interface NominationListSkeletonProps {
  count?: number;
  showImage?: boolean;
  className?: string;
}

export const NominationListSkeleton: React.FC<NominationListSkeletonProps> = ({
  count = 4,
  showImage = false,
  className = '',
}) => {
  return (
    <div className={`nomination-list--skeleton ${className}`} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <NominationCardSkeleton key={i} showImage={showImage} />
      ))}
    </div>
  );
};

// ============================================================================
// Results Skeleton
// ============================================================================

export interface ResultsSkeletonProps {
  barCount?: number;
  className?: string;
}

export const ResultsSkeleton: React.FC<ResultsSkeletonProps> = ({
  barCount = 5,
  className = '',
}) => {
  return (
    <div className={`results-skeleton ${className}`} aria-busy="true" aria-label="Загрузка результатов">
      {/* Header */}
      <div className="results-skeleton__header">
        <Skeleton width={200} height={24} />
        <Skeleton width={120} height={36} borderRadius={6} />
      </div>

      {/* Summary */}
      <div className="results-skeleton__summary">
        <div className="results-skeleton__stat">
          <Skeleton width={80} height={12} />
          <Skeleton width={60} height={28} />
        </div>
        <div className="results-skeleton__stat">
          <Skeleton width={80} height={12} />
          <Skeleton width={40} height={28} />
        </div>
      </div>

      {/* Winner */}
      <div className="results-skeleton__winner">
        <Skeleton width={24} height={24} borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width={60} height={20} borderRadius={10} />
          <Skeleton width="50%" height={18} />
          <Skeleton width={100} height={14} />
        </div>
      </div>

      {/* Chart bars */}
      <div className="results-skeleton__chart">
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} className="results-skeleton__bar">
            <Skeleton width={120} height={16} />
            <Skeleton width={`${20 + (i % 5) * 15}%`} height={24} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Page Header Skeleton
// ============================================================================

export interface PageHeaderSkeletonProps {
  showBreadcrumbs?: boolean;
  showMeta?: boolean;
  className?: string;
}

export const PageHeaderSkeleton: React.FC<PageHeaderSkeletonProps> = ({
  showBreadcrumbs = true,
  showMeta = true,
  className = '',
}) => {
  return (
    <div className={`page-header-skeleton ${className}`} aria-busy="true">
      {/* Breadcrumbs */}
      {showBreadcrumbs && (
        <div className="page-header-skeleton__breadcrumbs">
          <Skeleton width={60} height={16} />
          <Skeleton width={8} height={16} />
          <Skeleton width={100} height={16} />
          <Skeleton width={8} height={16} />
          <Skeleton width={140} height={16} />
        </div>
      )}

      {/* Title */}
      <Skeleton width="60%" height={32} className="page-header-skeleton__title" />

      {/* Description */}
      <Skeleton width="80%" height={18} />

      {/* Meta */}
      {showMeta && (
        <div className="page-header-skeleton__meta">
          <Skeleton width={150} height={14} />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Skeleton Styles (CSS-in-JS fallback)
// ============================================================================

export const skeletonStyles = `
.skeleton {
  background: var(--g-color-base-generic-medium, #e0e0e0);
  position: relative;
  overflow: hidden;
}

.skeleton--animated {
  background: linear-gradient(
    90deg,
    var(--g-color-base-generic-medium, #e0e0e0) 0%,
    var(--g-color-base-generic-light, #f0f0f0) 50%,
    var(--g-color-base-generic-medium, #e0e0e0) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.text-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voting-card--skeleton .voting-card__cover {
  background: var(--g-color-base-generic-medium, #e0e0e0);
}

.results-skeleton__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-skeleton__summary {
  display: flex;
  gap: 32px;
  margin-bottom: 24px;
}

.results-skeleton__stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.results-skeleton__winner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin-bottom: 24px;
  background: var(--g-color-base-generic-ultralight, #f5f5f5);
  border-radius: 12px;
}

.results-skeleton__chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.results-skeleton__bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-header-skeleton {
  margin-bottom: 24px;
}

.page-header-skeleton__breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.page-header-skeleton__title {
  margin-bottom: 12px;
}

.page-header-skeleton__meta {
  margin-top: 8px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton--animated {
    animation: none;
    background: var(--g-color-base-generic-medium, #e0e0e0);
  }
}
`;

// ============================================================================
// Export
// ============================================================================

export default {
  Skeleton,
  TextSkeleton,
  VotingCardSkeleton,
  VotingListSkeleton,
  NominationCardSkeleton,
  NominationListSkeleton,
  ResultsSkeleton,
  PageHeaderSkeleton,
};
