import { useState } from 'react';
import { Button, Pagination } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import { usePolls } from '../../../../features/voting';
import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import { PageLayout, PageState } from '../../../../shared/ui/portal/PortalUI';
import { formatDate } from '../../../../features/voting/utils/pollMeta';
import '../../styles/voting-workspace.css';

export function AnalyticsDashboardPage() {
  const base = useRouteBase();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = usePolls({
    status: 'closed',
    limit: 20,
    offset: (page - 1) * 20,
  });
  return (
    <div className="voting-workspace">
      <PageLayout
        title="Итоги голосований"
        actions={
          <Button
            size="xl"
            view="flat"
            onClick={() => navigate(`${base}/voting`)}
          >
            К голосованиям
          </Button>
        }
      >
        {isLoading ? (
          <PageState kind="loading" title="Загружаем итоги" />
        ) : isError ? (
          <PageState
            kind="error"
            title="Не удалось загрузить итоги"
            action={<Button onClick={() => void refetch()}>Повторить</Button>}
          />
        ) : !data?.items.length ? (
          <PageState
            kind="empty"
            title="Нет завершённых опросов"
            description="После закрытия опроса здесь появится ссылка на его результаты."
          />
        ) : (
          <>
            {data.items.map((poll) => (
              <article className="voting-result" key={poll.id}>
                <h2>{poll.title}</h2>
                <p className="voting-result__note">
                  {poll.ends_at
                    ? `Завершён: ${formatDate(poll.ends_at)}`
                    : 'Завершён'}
                </p>
                <Button
                  size="xl"
                  view="outlined"
                  onClick={() => navigate(`${base}/voting/${poll.id}/results`)}
                >
                  Результаты
                </Button>
              </article>
            ))}
            {data.pagination.total > 20 && (
              <Pagination
                page={page}
                pageSize={20}
                total={data.pagination.total}
                onUpdate={setPage}
              />
            )}
          </>
        )}
      </PageLayout>
    </div>
  );
}
