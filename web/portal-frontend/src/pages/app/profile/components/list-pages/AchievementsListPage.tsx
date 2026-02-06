import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { isApiError } from '../../../../../api/client';
import { listAchievements } from '../../../../../api/gamification';
import { profileHubStrings } from '../../strings/ru';
import { ListPageLayout } from './ListPageLayout';

export const AchievementsListPage: React.FC = () => {
  const query = useQuery({
    queryKey: ['profile-hub', 'achievements-list'],
    queryFn: async () => {
      try {
        const response = await listAchievements({ limit: 50 });
        return response.items;
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
      title={profileHubStrings.achievements.title}
      emptyText={profileHubStrings.achievements.empty}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      items={(query.data ?? []).map((item) => ({
        id: item.id,
        title: item.nameI18n.ru ?? item.nameI18n.en ?? 'Без названия',
        subtitle: item.category,
      }))}
    />
  );
};
