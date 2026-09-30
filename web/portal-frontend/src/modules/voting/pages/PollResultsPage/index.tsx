import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Checkbox, DropdownMenu } from '@gravity-ui/uikit';
import { PageLayout, PageState } from '../../../../shared/ui/portal/PortalUI';
import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import '../../styles/voting-workspace.css';
import { isApiError } from '../../../../api/client';
import { ResultsChart } from '../../../../features/voting/components/ResultsChart';
import { usePollInfo, usePollResults } from '../../../../features/voting';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useFormatters } from '@/shared/hooks/useFormatters';

export const PollResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = useRouteBase();
  const pollId = id ?? '';
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const { formatTime } = useFormatters();

  const {
    data: pollInfo,
    isLoading: isPollLoading,
    isError: isPollError,
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
  useDocumentTitle(
    pollInfo
      ? `${pollInfo.poll.title} · Результаты опроса`
      : 'Результаты опроса',
  );

  const nominationsWithTotals = useMemo(() => {
    if (!results) return [];
    return results.nominations.map((nomination) => {
      const totalVotes = nomination.options.reduce(
        (sum, option) => sum + option.votes,
        0,
      );
      const max = Math.max(
        0,
        ...nomination.options.map((option) => option.votes),
      );
      const leaders =
        max > 0
          ? nomination.options.filter((option) => option.votes === max)
          : [];
      return { ...nomination, totalVotes, leaders };
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
      [
        'nomination_id',
        'nomination_title',
        'option_id',
        'option_text',
        'votes',
      ],
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
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poll-results-${pollId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const back = (
    <Button size="xl" onClick={() => navigate(`${base}/voting/${pollId}`)}>
      Вернуться к опросу
    </Button>
  );
  if (isPollLoading || isResultsLoading)
    return <PageState kind="loading" title="Загружаем результаты" />;
  if (isPollError || !pollInfo)
    return (
      <PageState
        kind="error"
        title="Не удалось загрузить опрос"
        action={
          <Button size="xl" onClick={() => void refetchPollInfo()}>
            Повторить
          </Button>
        }
        secondaryAction={back}
      />
    );
  if (isResultsError) {
    const hidden =
      isApiError(resultsError) && resultsError.code === 'RESULTS_HIDDEN';
    return (
      <PageState
        kind={hidden ? 'unavailable' : 'error'}
        title={
          hidden ? 'Результаты пока скрыты' : 'Не удалось загрузить результаты'
        }
        description={
          hidden
            ? 'Результаты откроются согласно настройкам опроса.'
            : undefined
        }
        action={
          hidden ? (
            back
          ) : (
            <Button size="xl" onClick={handleRefresh}>
              Повторить
            </Button>
          )
        }
      />
    );
  }
  if (!results)
    return (
      <PageState kind="empty" title="Результатов пока нет" action={back} />
    );
  return (
    <div className="voting-workspace">
      <PageLayout
        title="Результаты опроса"
        description={pollInfo.poll.title}
        actions={
          <>
            <Button
              size="xl"
              view="flat"
              onClick={() => navigate(`${base}/voting/${pollId}`)}
            >
              К опросу
            </Button>
            <DropdownMenu
              defaultSwitcherProps={{
                size: 'xl',
                'aria-label': 'Действия с результатами',
              }}
              items={[
                {
                  text: 'Обновить',
                  action: handleRefresh,
                  disabled: isFetchingPollInfo || isFetchingResults,
                },
                { text: 'Скачать CSV', action: exportCsv },
              ]}
            />
          </>
        }
      >
        {nominationsWithTotals.length === 0 && (
          <PageState kind="empty" title="В опросе пока нет вопросов" />
        )}
        {nominationsWithTotals.map((nomination) => (
          <section className="voting-result" key={nomination.nomination_id}>
            <h2>{nomination.title}</h2>
            <p className="voting-result__note">
              {nomination.totalVotes === 0
                ? 'Пока никто не проголосовал.'
                : nomination.leaders.length > 1
                  ? 'У лидирующих вариантов равное число голосов.'
                  : null}
            </p>
            <ResultsChart
              nomination={nomination}
              totalVotes={nomination.totalVotes}
              showTitle={false}
            />
          </section>
        ))}
        <details className="portal-disclosure">
          <summary>Обновление результатов</summary>
          <Checkbox
            checked={liveUpdates}
            onUpdate={setLiveUpdates}
            content="Обновлять автоматически"
          />
          <p>Последнее ручное обновление: {formatTime(lastRefreshAt)}</p>
        </details>
      </PageLayout>
    </div>
  );
};
