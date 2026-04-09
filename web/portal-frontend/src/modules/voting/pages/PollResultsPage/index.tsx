import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Checkbox, Icon, Loader, Text } from '@gravity-ui/uikit';
import { ArrowDownToLine, ArrowRotateRight } from '@gravity-ui/icons';
import { isApiError } from '../../../../api/client';
import { ResultsChart } from '../../../../features/voting/components/ResultsChart';
import { usePollInfo, usePollResults } from '../../../../features/voting';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useFormatters } from '@/shared/hooks/useFormatters';

const pageShellStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 64px)',
  backgroundColor: 'var(--g-color-base-background)',
};

const centeredPageShellStyle: React.CSSProperties = {
  ...pageShellStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const pageContentStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
};

export const PollResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const pollId = id ?? '';
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const { formatTime } = useFormatters();

  const {
    data: pollInfo,
    isLoading: isPollLoading,
    isError: isPollError,
    error: pollError,
    refetch: refetchPollInfo,
    isFetching: isFetchingPollInfo,
  } = usePollInfo(pollId, {
    refetchInterval: liveUpdates ? 15_000 : false,
    refetchIntervalInBackground: true,
  });
  const {
    data: results,
    isLoading: isResultsLoading,
    isError: isResultsError,
    error: resultsError,
    refetch: refetchResults,
    isFetching: isFetchingResults,
  } = usePollResults(pollId, {
    refetchInterval: liveUpdates ? 15_000 : false,
    refetchIntervalInBackground: true,
  });
  useDocumentTitle(pollInfo ? `${pollInfo.poll.title} · Результаты опроса` : 'Результаты опроса');

  const nominationsWithTotals = useMemo(() => {
    if (!results) return [];
    return results.nominations.map((nomination) => {
      const totalVotes = nomination.options.reduce((sum, option) => sum + option.votes, 0);
      const topOption = [...nomination.options].sort((a, b) => b.votes - a.votes)[0];
      return { ...nomination, totalVotes, topOption };
    });
  }, [results]);

  const handleRefresh = () => {
    Promise.all([refetchPollInfo(), refetchResults()]).finally(() => {
      setLastRefreshAt(new Date());
    });
  };

  const exportCsv = () => {
    if (!results) return;
    const rows = [
      ['nomination_id', 'nomination_title', 'option_id', 'option_text', 'votes'],
      ...results.nominations.flatMap((nomination) =>
        nomination.options.map((option) => [
          nomination.nomination_id,
          nomination.title,
          option.option_id,
          option.text,
          String(option.votes),
        ]),
      ),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poll-results-${pollId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isPollLoading || isResultsLoading) {
    return (
      <div style={centeredPageShellStyle}>
        <Loader size="l" />
      </div>
    );
  }

  if (isPollError || !pollInfo) {
    return (
      <div className="p-4" style={centeredPageShellStyle}>
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить опрос</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {pollError instanceof Error ? pollError.message : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={() => refetchPollInfo()} view="action" width="max">
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  if (isResultsError) {
    const errorCode = isApiError(resultsError) ? resultsError.code : undefined;

    if (errorCode === 'RESULTS_HIDDEN') {
      return (
        <div className="p-4" style={centeredPageShellStyle}>
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
      <div className="p-4" style={centeredPageShellStyle}>
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить результаты</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {resultsError instanceof Error ? resultsError.message : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={handleRefresh} view="action" width="max">
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  const { poll } = pollInfo;

  if (!results) {
    return (
      <div className="p-4" style={centeredPageShellStyle}>
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
  const leader = nominationsWithTotals
    .flatMap((nomination) =>
      nomination.options.map((option) => ({
        nominationTitle: nomination.title,
        optionText: option.text,
        votes: option.votes,
      })),
    )
    .sort((a, b) => b.votes - a.votes)[0];

  return (
    <div style={pageShellStyle}>
      <div className="bg-white border-b border-slate-200">
        <div className="container px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={pageContentStyle}>
          <div>
            <Text variant="header-1" className="text-slate-900">Результаты опроса</Text>
            <Text variant="body-2" color="secondary" className="mt-1">
              {poll.title}
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              view="flat-secondary"
              onClick={handleRefresh}
              loading={isFetchingPollInfo || isFetchingResults}
              disabled={isFetchingPollInfo || isFetchingResults}
            >
              <Icon data={ArrowRotateRight} size={16} />
              <span className="ms-1">Обновить</span>
            </Button>
            <Button view="outlined" onClick={exportCsv} disabled={!results}>
              <Icon data={ArrowDownToLine} size={16} />
              <span className="ms-1">CSV</span>
            </Button>
            <Link to={`/app/voting/${pollId}`}>
              <Button view="outlined">К опросу</Button>
            </Link>
            <Link to="/app/voting">
              <Button view="action">Все опросы</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container px-4 py-6 space-y-6" style={pageContentStyle}>
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Live-обновление:</span>{' '}
              {liveUpdates ? 'включено (15с)' : 'выключено'}
              {' · '}
              <span className="font-semibold text-slate-800">Последнее обновление:</span>{' '}
              {formatTime(lastRefreshAt)}
            </div>
            <Checkbox checked={liveUpdates} onUpdate={setLiveUpdates} content="Автообновление результатов" />
          </div>
        </Card>

        <Alert
          theme="normal"
          title="Сводка"
          message={`Всего голосов: ${totalVotes}. Вопросов: ${nominationsWithTotals.length}.`}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <Text variant="caption-2" color="secondary">Всего голосов</Text>
            <Text variant="header-2">{totalVotes}</Text>
          </Card>
          <Card className="p-4">
            <Text variant="caption-2" color="secondary">Вопросов в опросе</Text>
            <Text variant="header-2">{nominationsWithTotals.length}</Text>
          </Card>
          <Card className="p-4">
            <Text variant="caption-2" color="secondary">Топ-кандидат</Text>
            <Text variant="body-2" className="font-medium">
              {leader ? `${leader.optionText} (${leader.votes})` : '—'}
            </Text>
            {leader && (
              <Text variant="caption-2" color="secondary">
                {leader.nominationTitle}
              </Text>
            )}
          </Card>
        </div>

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
