import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Loader, Text } from '@gravity-ui/uikit';
import { isApiError } from '../../../../api/client';
import { ResultsChart } from '../../../../features/voting/components/ResultsChart';
import { usePollInfo, usePollResults } from '../../../../features/voting';

export const PollResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const pollId = id ?? '';

  const { data: pollInfo, isLoading: isPollLoading, isError: isPollError, error: pollError } = usePollInfo(pollId);
  const {
    data: results,
    isLoading: isResultsLoading,
    isError: isResultsError,
    error: resultsError,
  } = usePollResults(pollId);

  const nominationsWithTotals = useMemo(() => {
    if (!results) return [];
    return results.nominations.map((nomination) => {
      const totalVotes = nomination.options.reduce((sum, option) => sum + option.votes, 0);
      const topOption = [...nomination.options].sort((a, b) => b.votes - a.votes)[0];
      return { ...nomination, totalVotes, topOption };
    });
  }, [results]);

  if (isPollLoading || isResultsLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (isPollError || !pollInfo) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить опрос</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {pollError instanceof Error ? pollError.message : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={() => window.location.reload()} view="action" width="max">
            Обновить
          </Button>
        </Card>
      </div>
    );
  }

  if (isResultsError) {
    const errorCode = isApiError(resultsError) ? resultsError.code : undefined;

    if (errorCode === 'RESULTS_HIDDEN') {
      return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 text-center">
            <Text variant="subheader-2" className="mb-2">Результаты пока скрыты</Text>
            <Text variant="body-2" color="secondary" className="mb-4">
              Результаты откроются согласно настройкам опроса.
            </Text>
            <Link to={`/app/voting/${pollId}`}>
              <Button view="action" width="max">
                Вернуться к опросу
              </Button>
            </Link>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить результаты</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {resultsError instanceof Error ? resultsError.message : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={() => window.location.reload()} view="action" width="max">
            Обновить
          </Button>
        </Card>
      </div>
    );
  }

  const { poll } = pollInfo;

  if (!results) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Результатов пока нет</Text>
          <Text variant="body-2" color="secondary">
            Итоги появятся после завершения голосования.
          </Text>
        </Card>
      </div>
    );
  }

  const totalVotes = nominationsWithTotals.reduce((sum, nomination) => sum + nomination.totalVotes, 0);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Text variant="header-1" className="text-slate-900">Результаты опроса</Text>
            <Text variant="body-2" color="secondary" className="mt-1">
              {poll.title}
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/app/voting/${pollId}`}>
              <Button view="outlined">К опросу</Button>
            </Link>
            <Link to="/app/voting">
              <Button view="action">Все опросы</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Alert
          theme="normal"
          title="Сводка"
          message={`Всего голосов: ${totalVotes}. Вопросов: ${nominationsWithTotals.length}.`}
        />

        {poll.description && (
          <Card className="p-4">
            <Text variant="body-2" color="secondary">
              {poll.description}
            </Text>
          </Card>
        )}

        <div className="space-y-6">
          {nominationsWithTotals.map((nomination) => (
            <Card key={nomination.nomination_id} className="p-6 space-y-4">
              <div>
                <Text variant="subheader-2">{nomination.title}</Text>
                <Text variant="body-2" color="secondary" className="mt-1">
                  Всего голосов: {nomination.totalVotes}{' '}
                  {nomination.topOption ? `· Лидер: ${nomination.topOption.text}` : ''}
                </Text>
              </div>
              <ResultsChart nomination={nomination} totalVotes={nomination.totalVotes} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
