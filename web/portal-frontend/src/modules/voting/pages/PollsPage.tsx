import { useUrlState } from '../../../shared/hooks/useUrlState';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Loader, Pagination, Text, TextInput } from '@gravity-ui/uikit';

import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { PollCard } from '../../../features/voting/components/PollCard';
import { isRateLimitError, usePolls } from '../../../features/voting';
import type { Poll, PollStatus } from '../../../features/voting';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { useFormatters } from '@/shared/hooks/useFormatters';
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
  const [statusFilter, setStatusFilter] = useUrlState<StatusFilter>(
    'status',
    'active',
    ['active', 'closed', 'draft', 'all'],
  );
  const [searchQuery, setSearchQuery] = useUrlState<string>('q', '');
  const { user } = useAuth();
  const routeBase = useRouteBase();
  const { intlLocale } = useFormatters();

  const offset = (page - 1) * PAGE_SIZE;
  const effectiveStatus =
    statusFilter === 'all' ? undefined : (statusFilter as PollStatus);
  const locale = intlLocale;
  const canManage = Boolean(
    user?.isSuperuser ||
      can(user, ['voting.votings.admin', 'voting.nominations.admin']),
  );

  const { data, isLoading, isError, error, refetch, isFetching } = usePolls({
    limit: PAGE_SIZE,
    offset,
    status: effectiveStatus,
  });

  const polls = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredPolls = useMemo(
    () => filterByQuery(polls, searchQuery),
    [polls, searchQuery],
  );
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

  const handlePageChange: React.ComponentProps<
    typeof Pagination
  >['onUpdate'] = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusTabs = useMemo(
    () =>
      STATUS_OPTIONS.filter(
        (option) => option.value !== 'draft' || canManage,
      ).map((option) => (
        <Button
          key={option.value}
          view="flat"
          size="xl"
          selected={statusFilter === option.value}
          onClick={() => {
            setStatusFilter(option.value);
            setPage(1);
          }}
        >
          {option.label}
        </Button>
      )),
    [statusFilter, setStatusFilter, canManage],
  );

  if (isLoading && !polls.length) {
    return <VotingLoadingState text="Загружаем голосования…" />;
  }

  if (isError && !polls.length) {
    if (isRateLimitError(error)) {
      return (
        <VotingRateLimitState
          retryAfter={error.retryAfter}
          onRetry={() => refetch()}
        />
      );
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
      actions={
        canManage ? (
          <>
            {canManage && (
              <Link to={`${routeBase}/voting/create`}>
                <Button view="action">Создать опрос</Button>
              </Link>
            )}
            {canManage && (
              <Link to={`${routeBase}/voting/templates`}>
                <Button view="outlined">Шаблоны</Button>
              </Link>
            )}
            {canManage && (
              <Link to={`${routeBase}/voting/analytics`}>
                <Button view="outlined">Аналитика</Button>
              </Link>
            )}
          </>
        ) : undefined
      }
    >
      <section className="voting-v2__filters" aria-label="Фильтры голосований">
        <div
          className="voting-v2__status-tabs"
          role="group"
          aria-label="Статус голосований"
        >
          {statusTabs}
        </div>
        <TextInput
          size="xl"
          value={searchQuery}
          onUpdate={setSearchQuery}
          placeholder="Найти голосование"
          controlProps={{
            'aria-label': 'Поиск голосований на текущей странице',
          }}
          hasClear
        />
        {isFetching ? <Loader size="s" /> : null}
      </section>

      {!filteredPolls.length ? (
        <VotingEmptyState
          title="Опросы не найдены"
          message={
            searchQuery
              ? 'Очистите строку поиска или выберите другой статус.'
              : canManage
                ? 'Создайте новый опрос или выберите шаблон.'
                : 'Когда организаторы опубликуют голосование, оно появится здесь.'
          }
          action={
            <div className="voting-v2__toolbar-right">
              {canManage && (
                <Link to={`${routeBase}/voting/create`}>
                  <Button view="action">Создать опрос</Button>
                </Link>
              )}
              {canManage && (
                <Link to={`${routeBase}/voting/templates`}>
                  <Button view="outlined">Открыть шаблоны</Button>
                </Link>
              )}
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
              const primaryLabel =
                poll.status === 'draft' && canManage ? 'Настроить' : 'Открыть';
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
              Показано {offset + 1}-
              {Math.min(offset + PAGE_SIZE, pagination.total)} из{' '}
              {pagination.total}
            </Text>
          )}
        </>
      )}
    </VotingPageLayout>
  );
};
