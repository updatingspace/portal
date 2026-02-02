import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const SecuritySectionSkeleton: React.FC = () => (
  <Card view="filled" className="p-4 mb-4" aria-busy="true">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <SkeletonText width="30%" height={18} />
    </div>

    <div className="d-flex flex-wrap gap-2 mb-3">
      <SkeletonBlock width={100} height={32} radius={16} />
      <SkeletonBlock width={150} height={32} radius={16} />
    </div>

    <SkeletonText width="45%" height={16} />
    <div style={{ marginTop: 16 }}>
      <SkeletonBlock width="190px" height={36} radius={18} />
    </div>
  </Card>
);
