import React from 'react';

import { profileHubStrings } from '../../strings/ru';
import { ListPageLayout } from './ListPageLayout';

export const FriendsListPage: React.FC = () => {
  return (
    <ListPageLayout
      title={profileHubStrings.friends.title}
      emptyText={profileHubStrings.friends.empty}
      items={[]}
    />
  );
};
