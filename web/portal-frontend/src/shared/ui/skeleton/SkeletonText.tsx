import React from 'react';
import { Skeleton } from '@gravity-ui/uikit';

type SkeletonTextProps = {
  width?: string;
  height?: number;
};

export const SkeletonText: React.FC<SkeletonTextProps> = ({ width = '80%', height = 14 }) => (
  <Skeleton
    style={{
      width,
      height,
      borderRadius: 6,
    }}
  />
);
