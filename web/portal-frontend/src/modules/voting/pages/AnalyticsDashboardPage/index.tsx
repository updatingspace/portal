import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Icon, Text } from '@gravity-ui/uikit';
import { ChartBar, ChartColumn, ChartLine } from '@gravity-ui/icons';

import { usePolls } from '../../../../features/voting';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { logger } from '../../../../utils/logger';
import {
  VotingEmptyState,
  VotingErrorState,
  VotingLoadingState,
  VotingPageLayout,
} from '../../ui';

const getVoteCount = (settings: Record<string, unknown>) => {
  const candidates = ['vote_count', 'votes_count', 'total_votes'];
  for (const key of candidates) {
    const value = settings[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
};

export const AnalyticsDashboardPage: React.FC = () => {
  const routeBase = useRouteBase();
  const { data: pollsData, isLoading, isError, error, refetch } = usePolls({ status: 'closed' });

  const polls = useMemo(() => pollsData?.items ?? [], [pollsData?.items]);

  const pollStats = useMemo(() => {
    const totalPolls = polls.length;
    const totalVotes = polls.reduce((sum, poll) => sum + getVoteCount(poll.settings ?? {}), 0);
    const avgParticipation = totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0;
    const sortedByVotes = [...polls].sort((a, b) => getVoteCount(b.settings ?? {}) - getVoteCount(a.settings ?? {}));
    return { totalPolls, totalVotes, avgParticipation, sortedByVotes };
  }, [polls]);

  useEffect(() => {
    if (!pollsData) return;
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'analytics',
        totalPolls: pollsData.pagination.total,
      },
    });
  }, [pollsData]);

  if (isLoading) {
    return <VotingLoadingState text="Загружаем аналитику…" />;
  }

  if (isError) {
    return (
      <VotingErrorState
        title="Не удалось загрузить аналитику"
        message={error instanceof Error ? error.message : 'Попробуйте обновить данные.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <VotingPageLayout
      title="Аналитика голосований"
      description="Итоги завершённых опросов и вовлечённость участников."
      actions={
        <Link to={`${routeBase}/voting`}>
          <Button view="outlined">К списку</Button>
        </Link>
      }
    >
      <div className="voting-v2__grid voting-v2__grid--3">
        <Card className="voting-v2__card">
          <div className="voting-v2__toolbar-left">
            <Icon data={ChartColumn} size={20} />
            <Text variant="subheader-2">Завершённых опросов</Text>
          </div>
          <Text variant="display-2">{pollStats.totalPolls}</Text>
        </Card>
        <Card className="voting-v2__card">
          <div className="voting-v2__toolbar-left">
            <Icon data={ChartBar} size={20} />
            <Text variant="subheader-2">Всего голосов</Text>
          </div>
          <Text variant="display-2">{pollStats.totalVotes}</Text>
        </Card>
        <Card className="voting-v2__card">
          <div className="voting-v2__toolbar-left">
            <Icon data={ChartLine} size={20} />
            <Text variant="subheader-2">Средняя активность</Text>
          </div>
          <Text variant="display-2">{pollStats.avgParticipation}</Text>
        </Card>
      </div>

      {polls.length === 0 ? (
        <VotingEmptyState
          title="Нет завершённых опросов"
          message="Когда появятся закрытые кампании, здесь отобразится аналитика."
          action={
            <Link to={`${routeBase}/voting/create`}>
              <Button view="action">Создать опрос</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="voting-v2__toolbar">
            <Text variant="subheader-2" className="voting-v2__section-title">Последние опросы</Text>
          </div>

          <div className="voting-v2__grid voting-v2__grid--3">
            {pollStats.sortedByVotes.slice(0, 6).map((poll) => {
              const votes = getVoteCount(poll.settings ?? {});
              return (
                <Card key={poll.id} className="voting-v2__card">
                  <Text variant="subheader-2" className="voting-v2__section-title">{poll.title}</Text>
                  <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                    {new Date(poll.created_at).toLocaleDateString('ru-RU')}
                  </Text>
                  <div className="voting-v2__toolbar" style={{ marginTop: 8 }}>
                    <span className="voting-v2__small voting-v2__muted">Голосов: {votes}</span>
                    <Link to={`${routeBase}/voting/${poll.id}/results`}>
                      <Button view="flat">Результаты</Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </VotingPageLayout>
  );
};
