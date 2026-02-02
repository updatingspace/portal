import React from 'react';

import { SkeletonBlock } from './SkeletonBlock';
import { SkeletonText } from './SkeletonText';

type SkeletonListProps = {
  rows?: number;
  gap?: number;
};

export const SkeletonList: React.FC<SkeletonListProps> = ({ rows = 3, gap = 20 }) => (
  <div
    className="portal-skeleton-list"
    style={{
      display: 'grid',
      gap,
    }}
  >
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} style={{ display: 'grid', gap: 10 }}>
        <SkeletonText width="45%" height={16} />
        <SkeletonBlock height={120} />
        <SkeletonText width="75%" height={14} />
      </div>
    ))}
  </div>
);
