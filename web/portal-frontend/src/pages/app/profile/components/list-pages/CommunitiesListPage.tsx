import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { isApiError } from '../../../../../api/client';
import { fetchPortalCommunities } from '../../../../../modules/portal/api';
import { profileHubStrings } from '../../strings/ru';
import { ListPageLayout } from './ListPageLayout';

export const CommunitiesListPage: React.FC = () => {
  const query = useQuery({
    queryKey: ['profile-hub', 'communities-list'],
    queryFn: async () => {
      try {
        return await fetchPortalCommunities();
      } catch (error) {
        if (isApiError(error) && (error.kind === 'forbidden' || error.kind === 'not_found')) {
          return [];
        }
        throw error;
      }
    },
    retry: false,
  });

  return (
    <ListPageLayout
      title={profileHubStrings.communities.title}
      emptyText={profileHubStrings.communities.empty}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      items={(query.data ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.description ?? undefined,
      }))}
    />
  );
};
