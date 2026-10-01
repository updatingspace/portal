import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DropdownMenu,
  Icon,
  Pagination,
  TextInput,
} from '@gravity-ui/uikit';
import { Ellipsis } from '@gravity-ui/icons';
import { useUrlState } from '../../../shared/hooks/useUrlState';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { PollCard } from '../../../features/voting/components/PollCard';
import { isRateLimitError, usePolls } from '../../../features/voting';
import type { PollStatus } from '../../../features/voting';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import {
  PageLayout,
  InlineError,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { SectionTabs } from '../../../shared/ui/portal/SectionTabs';
import { ListSkeleton } from '../../../shared/ui/portal/ListSkeleton';
import '../styles/voting-v2.css';

const PAGE_SIZE = 12;
type StatusFilter = PollStatus | 'all';
export function PollsPage() {
  const t = useUITranslation();
  const { user } = useAuth();
  const base = useRouteBase();
  const navigate = useNavigate();
  const { intlLocale } = useFormatters();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useUrlState<StatusFilter>('status', 'active', [
    'active',
    'closed',
    'draft',
    'all',
  ]);
  const [search, setSearch] = useUrlState<string>('q', '');
  const canManage = can(user, [
    'voting.votings.admin',
    'voting.nominations.admin',
  ]);
  const { data, isLoading, isError, error, refetch, isFetching } = usePolls({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    status: status === 'all' ? undefined : status,
  });
  const polls = useMemo(
    () =>
      (data?.items ?? []).filter((poll) =>
        `${poll.title} ${poll.description ?? ''}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [data, search],
  );
  return (
    <PageLayout title={t('Голосования', 'Voting')}>
      <div className="polls-browser">
        {canManage && (
          <div className="portal-actions polls-browser__manage">
            <Button
              view="action"
              size="l"
              onClick={() => navigate(`${base}/voting/create`)}
            >
              {t('Создать опрос', 'Create poll')}
            </Button>
            <DropdownMenu
              items={[
                {
                  text: t('Аналитика голосований', 'Voting analytics'),
                  action: () => navigate(`${base}/voting/analytics`),
                },
              ]}
              renderSwitcher={(props) => (
                <Button
                  {...props}
                  view="flat"
                  size="l"
                  aria-label={t('Управление голосованиями', 'Manage polls')}
                >
                  <Icon data={Ellipsis} />
                </Button>
              )}
            />
          </div>
        )}
        <SectionTabs
          label={t('Статус голосований', 'Poll status')}
          value={status}
          items={[
            { id: 'active', label: t('Активные', 'Active') },
            { id: 'closed', label: t('Завершённые', 'Closed') },
            ...(canManage
              ? [{ id: 'draft', label: t('Черновики', 'Drafts') }]
              : []),
            { id: 'all', label: t('Все', 'All') },
          ]}
          onChange={(value) => {
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        />
        <TextInput
          size="xl"
          value={search}
          onUpdate={setSearch}
          hasClear
          placeholder={t('Найти голосование', 'Find a poll')}
          controlProps={{
            'aria-label': t(
              'Поиск голосований на текущей странице',
              'Search polls on this page',
            ),
          }}
        />
        {isLoading ? (
          <ListSkeleton label={t('Загружаем голосования…', 'Loading polls')} />
        ) : (
          <>
            {isError && (
              <InlineError onRetry={() => void refetch()}>
                {isRateLimitError(error) ? (
                  <>
                    <strong>
                      {t('Слишком много запросов', 'Too many requests')}
                    </strong>
                    <p>
                      {t(
                        `Подождите ${error.retryAfter} сек. и попробуйте снова.`,
                        `Wait ${error.retryAfter} seconds and try again.`,
                      )}
                    </p>
                  </>
                ) : (
                  t('Не удалось загрузить список', 'Unable to load polls')
                )}
              </InlineError>
            )}
            {!isError && !polls.length && (
              <section className="portal-list-empty" role="status">
                <h2>
                  {search
                    ? t('Совпадений нет', 'No matches')
                    : t('Опросы не найдены', 'No polls yet')}
                </h2>
                <p>
                  {search
                    ? t(
                        'Очистите строку поиска или выберите другой статус.',
                        'Clear your search or choose another status.',
                      )
                    : t(
                        'Когда организаторы опубликуют голосование, оно появится здесь.',
                        'Published polls will appear here.',
                      )}
                </p>
                {search && (
                  <Button onClick={() => setSearch('')}>
                    {t('Сбросить поиск', 'Clear search')}
                  </Button>
                )}
              </section>
            )}
            <div className="polls-browser__list" aria-busy={isFetching}>
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  locale={intlLocale}
                  actions={
                    <>
                      <Button
                        view="action"
                        size="l"
                        onClick={() =>
                          navigate(
                            `${base}/voting/${poll.id}${poll.status === 'draft' && canManage ? '/manage' : ''}`,
                          )
                        }
                      >
                        {poll.status === 'draft' && canManage
                          ? t('Настроить', 'Set up')
                          : t('Открыть', 'Open')}
                      </Button>
                      {canManage && poll.status !== 'draft' && (
                        <Button
                          view="flat"
                          size="l"
                          onClick={() =>
                            navigate(`${base}/voting/${poll.id}/manage`)
                          }
                        >
                          {t('Управление', 'Manage')}
                        </Button>
                      )}
                      {poll.status === 'closed' && (
                        <Button
                          view="flat"
                          size="l"
                          onClick={() =>
                            navigate(`${base}/voting/${poll.id}/results`)
                          }
                        >
                          {t('Результаты', 'Results')}
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
            {(data?.pagination.total ?? 0) > PAGE_SIZE && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination.total ?? 0}
                onUpdate={setPage}
              />
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
