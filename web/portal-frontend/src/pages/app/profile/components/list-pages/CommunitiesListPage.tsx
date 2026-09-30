import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchEntryMe } from '../../../../../api/tenant';
import { useUITranslation } from '../../../../../shared/ui/portal/PortalUI';
import { ListPageLayout } from './ListPageLayout';
export function CommunitiesListPage() {
  const { user } = useAuth();
  const t = useUITranslation();
  const query = useQuery({
    queryKey: ['profile-hub', 'communities-list', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () =>
      (await fetchEntryMe()).memberships.filter(
        (item) => item.status === 'active',
      ),
    retry: false,
  });
  return (
    <ListPageLayout
      title={t('Мои сообщества', 'My communities')}
      emptyText={t('У вас пока нет сообществ', 'No communities yet')}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      items={(query.data ?? []).map((item) => ({
        id: item.tenant_id,
        title: item.display_name || item.tenant_slug,
        href: `/t/${encodeURIComponent(item.tenant_slug)}`,
        meta:
          item.tenant_id === user?.tenant?.id
            ? t('Текущее сообщество', 'Current community')
            : undefined,
      }))}
    />
  );
}
