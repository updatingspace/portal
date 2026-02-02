import React from 'react';
import { Skeleton } from '@gravity-ui/uikit';

type SkeletonBlockProps = {
  width?: string;
  height?: number | string;
  radius?: number;
  className?: string;
};

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 120,
  radius = 12,
  className,
}) => (
  <div
    className={['portal-skeleton-block', className].filter(Boolean).join(' ')}
    aria-hidden="true"
    style={{ display: 'flex', justifyContent: 'center' }}
  >
    <Skeleton
      style={{
        width,
        height,
        borderRadius: radius,
      }}
    />
  </div>
);
