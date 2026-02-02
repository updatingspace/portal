import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const ProfileSectionSkeleton: React.FC = () => (
  <Card view="filled" className="p-4 mb-4" aria-busy="true">
    <div className="d-flex align-items-center gap-2 mb-3">
      <SkeletonBlock width={160} height={20} radius={6} />
    </div>

    <div className="d-flex align-items-center gap-3 mb-3">
      <SkeletonBlock width={56} height={56} radius={28} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock width="70%" height={18} radius={6} />
        <SkeletonText width="50%" height={16} />
      </div>
    </div>

    <SkeletonText width="90%" height={16} />
    <div style={{ marginTop: 16 }}>
      <SkeletonBlock width="170px" height={36} radius={18} />
    </div>
  </Card>
);
