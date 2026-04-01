/**
 * VotingCardSkeleton Component
 * 
 * Loading placeholder for VotingCard with shimmer animation.
 * Matches the structure of VotingCard for smooth loading UX.
 */

import React from 'react';

export interface VotingCardSkeletonProps {
  variant?: 'large' | 'medium' | 'small';
  className?: string;
}

export const VotingCardSkeleton: React.FC<VotingCardSkeletonProps> = ({
  variant = 'medium',
  className = '',
}) => {
  const variantClass = `voting-card--${variant}`;
  
  return (
    <div className={`voting-card voting-card-skeleton ${variantClass} ${className}`} aria-busy="true" aria-label="Загрузка голосования">
      {/* Cover Skeleton */}
      <div className="voting-card__cover skeleton-shimmer">
        <div className="voting-card__cover-top">
          <span className="skeleton-box skeleton-box--small" />
          <span className="skeleton-box skeleton-box--small" />
        </div>
        <div className="voting-card__cover-title">
          <span className="skeleton-box skeleton-box--wide" />
        </div>
      </div>
      
      {/* Body Skeleton */}
      <div className="voting-card__body">
        {/* Description Skeleton */}
        <div className="voting-card__description">
          <span className="skeleton-box skeleton-box--line" />
          <span className="skeleton-box skeleton-box--line" />
          <span className="skeleton-box skeleton-box--line skeleton-box--short" />
        </div>
        
        {/* Meta Skeleton */}
        <div className="voting-card__meta">
          <span className="skeleton-box skeleton-box--small" />
        </div>
        
        {/* Footer Skeleton */}
        <div className="voting-card__footer">
          <span className="skeleton-box skeleton-box--button" />
        </div>
      </div>
    </div>
  );
};

export default VotingCardSkeleton;
