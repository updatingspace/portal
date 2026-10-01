import { useFormatters } from '../../../../shared/hooks/useFormatters';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchEvents } from '../../../../api/events';
import { fetchFeedV2 } from '../../../../api/activity';
import { fetchPolls } from '../../../../features/voting/api/votingApi';
import { useAuth } from '../../../../contexts/AuthContext';
import { can } from '../../../../features/rbac/can';
import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import {
  InlineError,
  useUITranslation,
} from '../../../../shared/ui/portal/PortalUI';

type Kind = 'events' | 'feed' | 'voting';
type Entry = { id: string; title: string; startsAt?: string };
export function CommunityWidget({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const base = useRouteBase();
  const t = useUITranslation();
  const { formatDateTime } = useFormatters();
  const permission = {
    events: 'events.event.read',
    feed: 'activity.feed.read',
    voting: 'voting.poll.read',
  }[kind];
  const allowed = can(user, permission);
  const query = useQuery<Entry[]>({
    queryKey: [
      'community-overview',
      user?.tenant?.id,
      user?.id,
      user?.language,
      kind,
    ],
    enabled: allowed,
    queryFn: async () => {
      if (kind === 'events')
        return (await fetchEvents({ period: 'upcoming', limit: 3 })).items.map(
          (event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
          }),
        );
      if (kind === 'voting')
        return (await fetchPolls({ status: 'active', limit: 3 })).items.map(
          (poll) => ({ id: poll.id, title: poll.title }),
        );
      return (await fetchFeedV2({ limit: 4 })).items.map((item) => ({
        id: String(item.id),
        title: String(
          item.payloadJson.title ||
            item.payloadJson.body ||
            t('Новая активность', 'New activity'),
        ).slice(0, 180),
      }));
    },
  });
  if (!allowed)
    return (
      <p>
        {t(
          'Этот блок недоступен с вашими правами.',
          'This section is unavailable with your permissions.',
        )}
      </p>
    );
  if (query.isLoading)
    return (
      <p role="status" aria-busy="true">
        {t('Загружаем…', 'Loading…')}
      </p>
    );
  return (
    <div className="dashboard-list">
      {query.isError && (
        <InlineError onRetry={() => void query.refetch()}>
          {t(
            'Не удалось обновить этот блок.',
            'Unable to refresh this section.',
          )}
        </InlineError>
      )}
      {query.data?.length === 0 && (
        <p>{t('Здесь пока нет записей.', 'There is nothing here yet.')}</p>
      )}
      {query.data?.map((item) => (
        <div className="dashboard-list__item" key={item.id}>
          <Link to={`${base}/${kind}${kind === 'feed' ? '' : `/${item.id}`}`}>
            {item.title}
          </Link>
          {item.startsAt && <small>{formatDateTime(item.startsAt)}</small>}
        </div>
      ))}
    </div>
  );
}
