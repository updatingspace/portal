import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';

export const ProfileHeaderSkeleton: React.FC = () => (
  <Card view="filled" className="profile-hub__header-card" aria-busy="true">
    <div className="profile-hub__header-main">
      <SkeletonBlock width="88px" height={88} radius={44} />
      <div className="profile-hub__header-meta-skeleton">
        <SkeletonBlock width="40%" height={28} radius={8} />
        <SkeletonBlock width="25%" height={16} radius={8} />
        <SkeletonBlock width="80%" height={16} radius={8} />
      </div>
    </div>
  </Card>
);
