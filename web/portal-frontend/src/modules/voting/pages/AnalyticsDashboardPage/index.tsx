import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Icon, Loader, Text } from '@gravity-ui/uikit';
import { ChartBar, ChartColumn, ChartLine } from '@gravity-ui/icons';
import { usePolls } from '../../../../features/voting';

const getVoteCount = (settings: Record<string, unknown>) => {
  const candidates = ['vote_count', 'votes_count', 'total_votes'];
  for (const key of candidates) {
    const value = settings[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
};

export const AnalyticsDashboardPage: React.FC = () => {
  const { data: pollsData, isLoading, isError, error } = usePolls({ status: 'closed' });

  const polls = pollsData?.items || [];

  const pollStats = useMemo(() => {
    const totalPolls = polls.length;
    const totalVotes = polls.reduce((sum, poll) => sum + getVoteCount(poll.settings ?? {}), 0);
    const avgParticipation = totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0;
    const sortedByVotes = [...polls].sort((a, b) => getVoteCount(b.settings ?? {}) - getVoteCount(a.settings ?? {}));
    return { totalPolls, totalVotes, avgParticipation, sortedByVotes };
  }, [polls]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить аналитику</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу.'}
          </Text>
          <Button onClick={() => window.location.reload()} view="action" width="max">
            Обновить
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Text variant="header-1" className="text-slate-900">Аналитика голосований</Text>
          <Text variant="body-2" color="secondary" className="mt-1">
            Итоги завершённых опросов и вовлечённость участников.
          </Text>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon data={ChartColumn} size={20} className="text-indigo-500" />
              <Text variant="subheader-2">Завершённых опросов</Text>
            </div>
            <Text variant="display-2" className="mt-3 text-slate-900">{pollStats.totalPolls}</Text>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon data={ChartBar} size={20} className="text-emerald-500" />
              <Text variant="subheader-2">Всего голосов</Text>
            </div>
            <Text variant="display-2" className="mt-3 text-slate-900">{pollStats.totalVotes}</Text>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon data={ChartLine} size={20} className="text-amber-500" />
              <Text variant="subheader-2">Средняя активность</Text>
            </div>
            <Text variant="display-2" className="mt-3 text-slate-900">{pollStats.avgParticipation}</Text>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <Text variant="subheader-2">Последние опросы</Text>
          <Button view="outlined" href="/app/voting">К списку</Button>
        </div>

        {polls.length === 0 ? (
          <Card className="p-6 text-center">
            <Text variant="body-2" color="secondary">Нет завершённых опросов для аналитики.</Text>
            <Button view="action" href="/app/voting/create" className="mt-4">
              Создать опрос
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pollStats.sortedByVotes.slice(0, 6).map((poll) => {
              const votes = getVoteCount(poll.settings ?? {});
              return (
                <Card key={poll.id} className="p-5">
                  <Text variant="subheader-2">{poll.title}</Text>
                  <Text variant="body-2" color="secondary" className="mt-1">
                    {new Date(poll.created_at).toLocaleDateString('ru-RU')}
                  </Text>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <span>Голосов: {votes}</span>
                    <Link to={`/app/voting/${poll.id}/results`} className="text-indigo-600 hover:text-indigo-500">
                      Результаты
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
