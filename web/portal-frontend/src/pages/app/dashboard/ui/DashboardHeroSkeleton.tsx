import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const DashboardHeroSkeleton: React.FC = () => (
  <Card view="filled" className="mb-4 p-4" aria-busy="true">
    <div className="d-flex flex-column gap-3">
      <SkeletonText width="40%" height={14} />
      <SkeletonText width="60%" height={32} />
      <SkeletonText width="65%" height={18} />
      <div className="d-flex flex-wrap gap-2">
        <SkeletonBlock width={140} height={40} radius={8} />
        <SkeletonBlock width={160} height={40} radius={8} />
        <SkeletonBlock width={130} height={40} radius={8} />
      </div>
    </div>
  </Card>
);
