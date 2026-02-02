import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const ProfileHeroSkeleton: React.FC = () => (
  <Card view="filled" className="p-4 mb-4" aria-busy="true">
    <div className="d-flex align-items-start gap-4">
      <SkeletonBlock width={72} height={72} radius={36} />

      <div className="flex-grow-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonText width="40%" height={24} />
        <SkeletonText width="30%" height={18} />

        <div className="d-flex flex-wrap gap-2">
          <SkeletonBlock width={80} height={32} radius={16} />
          <SkeletonBlock width={110} height={32} radius={16} />
          <SkeletonBlock width={90} height={32} radius={16} />
        </div>

        <div className="d-flex flex-wrap gap-2" style={{ marginTop: 8 }}>
          <SkeletonBlock width={140} height={36} radius={18} />
          <SkeletonBlock width={120} height={36} radius={18} />
        </div>
      </div>
    </div>
  </Card>
);
