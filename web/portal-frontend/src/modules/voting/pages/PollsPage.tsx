import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Loader, Pagination, Text, TextInput } from '@gravity-ui/uikit';

import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { PollCard } from '../../../features/voting/components/PollCard';
import { isRateLimitError, usePolls } from '../../../features/voting';
import type { Poll, PollStatus } from '../../../features/voting';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { getLocale } from '@/shared/lib/locale';
import { logger } from '../../../utils/logger';
import {
  VotingEmptyState,
  VotingErrorState,
  VotingLoadingState,
  VotingPageLayout,
  VotingRateLimitState,
} from '../ui';

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'draft', label: 'Черновики' },
  { value: 'closed', label: 'Завершённые' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

const filterByQuery = (polls: Poll[], query: string): Poll[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return polls;
  }

  return polls.filter((poll) => {
    const title = poll.title.toLowerCase();
    const description = (poll.description ?? '').toLowerCase();
    return title.includes(normalized) || description.includes(normalized);
  });
};

export const PollsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const routeBase = useRouteBase();

  const offset = (page - 1) * PAGE_SIZE;
  const effectiveStatus = statusFilter === 'all' ? undefined : (statusFilter as PollStatus);
  const locale = user?.language ?? getLocale();
  const hasCapabilities = Boolean(user?.capabilities?.length || user?.roles?.length);
  const canManage = Boolean(user?.isSuperuser || (!hasCapabilities ? true : can(user, ['voting.votings.admin', 'voting.nominations.admin'])));

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePolls({
    limit: PAGE_SIZE,
    offset,
    status: effectiveStatus,
  });

  const polls = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredPolls = useMemo(() => filterByQuery(polls, searchQuery), [polls, searchQuery]);
  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;

  useEffect(() => {
    if (!data) return;
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'polls',
        statusFilter,
        total: data.pagination.total,
      },
    });
  }, [data, statusFilter]);

  const handlePageChange: React.ComponentProps<typeof Pagination>['onUpdate'] = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusTabs = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          view={statusFilter === option.value ? 'action' : 'outlined'}
          size="s"
          onClick={() => {
            setStatusFilter(option.value);
            setPage(1);
          }}
        >
          {option.label}
        </Button>
      )),
    [statusFilter],
  );

  if (isLoading && !polls.length) {
    return <VotingLoadingState text="Загружаем голосования…" />;
  }

  if (isError && !polls.length) {
    if (isRateLimitError(error)) {
      return <VotingRateLimitState retryAfter={error.retryAfter} onRetry={() => refetch()} />;
    }

    return (
      <VotingErrorState
        title="Не удалось загрузить список"
        message="Проверьте соединение и попробуйте снова."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <VotingPageLayout
      title="Голосования"
      description="Управляйте опросами и следите за участием сообщества."
      actions={
        <>
          {canManage && (
            <Link to={`${routeBase}/voting/create`}>
              <Button view="action">Создать опрос</Button>
            </Link>
          )}
          <Link to={`${routeBase}/voting/templates`}>
            <Button view="outlined">Шаблоны</Button>
          </Link>
          <Link to={`${routeBase}/voting/analytics`}>
            <Button view="outlined">Аналитика</Button>
          </Link>
        </>
      }
    >
      <Card className="voting-v2__card voting-v2__card--soft">
        <div className="voting-v2__toolbar">
          <div>
            <Text variant="subheader-2" className="voting-v2__section-title">Быстрый обзор</Text>
            <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
              Фильтруйте по статусу и находите опрос по названию.
            </Text>
          </div>
          <div className="voting-v2__toolbar-right">{statusTabs}</div>
        </div>

        <div className="voting-v2__toolbar" style={{ marginTop: 12 }}>
          <TextInput
            value={searchQuery}
            onUpdate={setSearchQuery}
            placeholder="Поиск по названию или описанию"
            hasClear
          />
          {isFetching ? <Loader size="s" /> : null}
        </div>
      </Card>

      {!filteredPolls.length ? (
        <VotingEmptyState
          title="Опросы не найдены"
          message={searchQuery ? 'Очистите строку поиска или выберите другой статус.' : 'Создайте новый опрос или выберите шаблон.'}
          action={
            <div className="voting-v2__toolbar-right">
              {canManage && (
                <Link to={`${routeBase}/voting/create`}>
                  <Button view="action">Создать опрос</Button>
                </Link>
              )}
              <Link to={`${routeBase}/voting/templates`}>
                <Button view="outlined">Открыть шаблоны</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="voting-v2__grid voting-v2__grid--polls">
            {filteredPolls.map((poll) => {
              const primaryLink =
                poll.status === 'draft' && canManage
                  ? `${routeBase}/voting/${poll.id}/manage`
                  : `${routeBase}/voting/${poll.id}`;
              const primaryLabel = poll.status === 'draft' && canManage ? 'Настроить' : 'Открыть';
              const showManage = canManage && poll.status !== 'draft';
              const showResults = poll.status === 'closed';

              return (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  locale={locale}
                  actions={
                    <>
                      <Link to={primaryLink}>
                        <Button view="action" size="m">
                          {primaryLabel}
                        </Button>
                      </Link>
                      {showManage && (
                        <Link to={`${routeBase}/voting/${poll.id}/manage`}>
                          <Button view="outlined" size="m">
                            Управление
                          </Button>
                        </Link>
                      )}
                      {showResults && (
                        <Link to={`${routeBase}/voting/${poll.id}/results`}>
                          <Button view="outlined" size="m">
                            Результаты
                          </Button>
                        </Link>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="voting-v2__state-wrap">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={pagination?.total ?? 0}
                onUpdate={handlePageChange}
              />
            </div>
          )}

          {pagination && (
            <Text variant="caption-2" color="secondary">
              Показано {offset + 1}-{Math.min(offset + PAGE_SIZE, pagination.total)} из {pagination.total}
            </Text>
          )}
        </>
      )}
    </VotingPageLayout>
  );
};
