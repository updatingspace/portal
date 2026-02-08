import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Text } from '@gravity-ui/uikit';

import { isApiError } from '../../../../api/client';
import { ResultsChart } from '../../../../features/voting/components/ResultsChart';
import { usePollInfo, usePollResults } from '../../../../features/voting';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { logger } from '../../../../utils/logger';
import {
  VotingEmptyState,
  VotingErrorState,
  VotingLoadingState,
  VotingPageLayout,
} from '../../ui';

export const PollResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const routeBase = useRouteBase();
  const pollId = id ?? '';

  const {
    data: pollInfo,
    isLoading: isPollLoading,
    isError: isPollError,
    error: pollError,
    refetch: refetchPoll,
  } = usePollInfo(pollId);
  const {
    data: results,
    isLoading: isResultsLoading,
    isError: isResultsError,
    error: resultsError,
    refetch: refetchResults,
  } = usePollResults(pollId);

  const nominationsWithTotals = useMemo(() => {
    if (!results) return [];
    return results.nominations.map((nomination) => {
      const totalVotes = nomination.options.reduce((sum, option) => sum + option.votes, 0);
      const topOption = [...nomination.options].sort((a, b) => b.votes - a.votes)[0];
      return { ...nomination, totalVotes, topOption };
    });
  }, [results]);

  const retryAll = () => {
    refetchPoll();
    refetchResults();
  };

  useEffect(() => {
    if (!results) return;
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'results',
        pollId,
        nominations: results.nominations.length,
      },
    });
  }, [pollId, results]);

  if (isPollLoading || isResultsLoading) {
    return <VotingLoadingState text="Загружаем результаты…" />;
  }

  if (isPollError || !pollInfo) {
    return (
      <VotingErrorState
        title="Не удалось загрузить опрос"
        message={pollError instanceof Error ? pollError.message : 'Проверьте соединение и попробуйте снова.'}
        onRetry={retryAll}
      />
    );
  }

  if (isResultsError) {
    const errorCode = isApiError(resultsError) ? resultsError.code : undefined;

    if (errorCode === 'RESULTS_HIDDEN') {
      return (
        <VotingEmptyState
          title="Результаты пока скрыты"
          message="Результаты откроются согласно настройкам опроса."
          action={
            <Link to={`${routeBase}/voting/${pollId}`}>
              <Button view="action">Вернуться к опросу</Button>
            </Link>
          }
        />
      );
    }

    return (
      <VotingErrorState
        title="Не удалось загрузить результаты"
        message={resultsError instanceof Error ? resultsError.message : 'Проверьте соединение и попробуйте снова.'}
        onRetry={retryAll}
      />
    );
  }

  const { poll } = pollInfo;

  if (!results) {
    return (
      <VotingEmptyState
        title="Результатов пока нет"
        message="Итоги появятся после завершения голосования."
      />
    );
  }

  const totalVotes = nominationsWithTotals.reduce((sum, nomination) => sum + nomination.totalVotes, 0);

  return (
    <VotingPageLayout
      title="Результаты опроса"
      description={poll.title}
      actions={
        <>
          <Link to={`${routeBase}/voting/${pollId}`}>
            <Button view="outlined">К опросу</Button>
          </Link>
          <Link to={`${routeBase}/voting`}>
            <Button view="action">Все опросы</Button>
          </Link>
        </>
      }
    >
      <Alert
        theme="normal"
        title="Сводка"
        message={`Всего голосов: ${totalVotes}. Вопросов: ${nominationsWithTotals.length}.`}
      />

      {poll.description ? (
        <Card className="voting-v2__card">
          <Text variant="body-2" color="secondary">
            {poll.description}
          </Text>
        </Card>
      ) : null}

      <div className="voting-v2__grid">
        {nominationsWithTotals.map((nomination) => (
          <Card key={nomination.nomination_id} className="voting-v2__card">
            <div className="voting-v2__grid" style={{ marginBottom: 8 }}>
              <Text variant="subheader-2" className="voting-v2__section-title">{nomination.title}</Text>
              <Text variant="body-2" color="secondary">
                Всего голосов: {nomination.totalVotes}{' '}
                {nomination.topOption ? `· Лидер: ${nomination.topOption.text}` : ''}
              </Text>
            </div>
            <ResultsChart nomination={nomination} totalVotes={nomination.totalVotes} />
          </Card>
        ))}
      </div>
    </VotingPageLayout>
  );
};
