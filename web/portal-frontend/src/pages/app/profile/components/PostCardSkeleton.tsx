import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';

export const PostCardSkeleton: React.FC = () => (
  <Card view="filled" className="profile-hub__post-skeleton" aria-busy="true">
    <div className="profile-hub__post-skeleton-row">
      <SkeletonBlock width="36px" height={36} radius={18} />
      <div className="profile-hub__post-skeleton-content">
        <SkeletonBlock width="35%" height={14} radius={8} />
        <SkeletonBlock width="80%" height={16} radius={8} />
        <SkeletonBlock width="65%" height={16} radius={8} />
      </div>
    </div>
  </Card>
);
