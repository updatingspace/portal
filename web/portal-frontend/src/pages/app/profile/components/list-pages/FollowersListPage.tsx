import React from 'react';

import { profileHubStrings } from '../../strings/ru';
import { ListPageLayout } from './ListPageLayout';

export const FollowersListPage: React.FC = () => {
  return (
    <ListPageLayout
      title={profileHubStrings.followers.title}
      emptyText={profileHubStrings.followers.empty}
      items={[]}
    />
  );
};
