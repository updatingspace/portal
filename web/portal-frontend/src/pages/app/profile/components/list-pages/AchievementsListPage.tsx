import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@gravity-ui/uikit';
import { useAuth } from '../../../../../contexts/AuthContext';
import { listAchievements } from '../../../../../api/gamification';
import { useRouteBase } from '../../../../../shared/hooks/useRouteBase';
import { useUITranslation } from '../../../../../shared/ui/portal/PortalUI';
import { ListPageLayout } from './ListPageLayout';

export function AchievementsListPage() {
  const { user } = useAuth();
  const base = useRouteBase();
  const t = useUITranslation();
  const query = useInfiniteQuery({
    queryKey: [
      'gamification',
      'achievements',
      'profile',
      user?.tenant?.id,
      user?.id,
    ],
    enabled: Boolean(user?.tenant?.id && user?.id),
    queryFn: ({ pageParam }) =>
      listAchievements({ limit: 20, earned: true, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor || undefined,
    retry: false,
  });
  return (
    <ListPageLayout
      title={t('Мои награды', 'My awards')}
      emptyText={t('У вас пока нет наград', 'No awards yet')}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      items={(query.data?.pages.flatMap((page) => page.items) ?? []).map(
        (item) => ({
          id: item.id,
          title:
            item.nameI18n[user?.language || 'ru'] ||
            item.nameI18n.ru ||
            item.nameI18n.en ||
            t('Без названия', 'Untitled'),
          subtitle: item.description || undefined,
          image: item.images?.small || item.images?.medium,
          href: `${base}/gamification/achievements/${item.id}`,
        }),
      )}
      footer={
        query.hasNextPage && (
          <Button
            size="xl"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t('Загрузить ещё', 'Load more')}
          </Button>
        )
      }
    />
  );
}
