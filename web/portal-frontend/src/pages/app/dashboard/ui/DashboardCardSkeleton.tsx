import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const DashboardCardSkeleton: React.FC = () => (
  <Card view="filled" className="p-3 h-100" aria-busy="true">
    <SkeletonText width="50%" height={16} />
    <div className="my-2">
      <SkeletonText width="35%" height={32} />
    </div>
    <SkeletonText width="80%" height={14} />
    <div style={{ marginTop: 12 }}>
      <SkeletonBlock width="70%" height={16} radius={6} />
    </div>
  </Card>
);
