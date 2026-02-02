import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../../../api/client';
import { fetchNominations } from '../../../api/nominations';
import { fetchVotingCatalog } from '../../../api/votings';
import type { VotingCatalogItem } from '../../../api/votings';
import type { Nomination } from '../../../data/nominations';
import { getApiErrorMeta, notifyApiError } from '../../../utils/apiErrorHandling';

export function NominationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const voting = searchParams.get('voting')?.trim() || '';

  const [catalog, setCatalog] = useState<VotingCatalogItem[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVotingCatalog();
      setCatalog(data);
    } catch (e) {
      notifyApiError(e, 'Не получилось загрузить голосования');
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNominations = useCallback(async () => {
    if (!voting) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNominations(voting);
      setNominations(data);
    } catch (e) {
      notifyApiError(e, 'Не получилось загрузить номинации');
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [voting]);

  useEffect(() => {
    if (voting) {
      loadNominations();
    } else {
      loadCatalog();
    }
  }, [loadCatalog, loadNominations, voting]);

  const errorMeta = useMemo(() => (error ? getApiErrorMeta(error) : null), [error]);

  if (loading && !catalog.length && !nominations.length) {
    return (
      <div className="container py-4">
        <div className="status-block status-block-info">
          <Loader size="l" />
          <div className="text-muted mt-2">Загружаем…</div>
        </div>
      </div>
    );
  }

  if (error && !catalog.length && !nominations.length) {
    const retry = voting ? loadNominations : loadCatalog;
    return (
      <div className="container py-4">
        <div className="status-block status-block-danger">
          <div className="status-title">{errorMeta?.title ?? 'Ошибка'}</div>
          <p className="text-muted mb-3">{errorMeta?.description}</p>
          <Button view="outlined" onClick={retry}>Попробовать еще раз</Button>
        </div>
      </div>
    );
  }

  if (!voting) {
    return (
      <div className="container py-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h1 className="page-title mb-0">Голосования</h1>
        </div>

        {!catalog.length ? (
          <div className="status-block status-block-warning">
            <div className="status-title">Пока нет голосований</div>
            <p className="text-muted mb-0">Если ожидаете голосование — проверьте позже.</p>
          </div>
        ) : (
          <div className="row row-cols-1 row-cols-md-2 g-3">
            {catalog.map((v) => (
              <div className="col" key={v.id}>
                <div className="status-block status-block-info" style={{ height: '100%' }}>
                  <div className="status-title">{v.title}</div>
                  {v.description ? <p className="text-muted">{v.description}</p> : null}
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      view="action"
                      onClick={() => setSearchParams({ voting: v.id })}
                      disabled={!v.isActive}
                    >
                      Открыть
                    </Button>
                    <Link className="btn btn-outline-secondary" to="/">На главную</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const votingInfo = nominations[0]?.voting ?? null;

  return (
    <div className="page-section nominations-page">
      <div className="container">
        <div className="row">
          <section className="col-12 col-lg-10 mx-auto">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h1 className="page-title">{votingInfo?.title ?? `Голосование ${voting}`}</h1>
                <p className="text-muted mb-1">
                  {votingInfo?.description ?? 'Выберите номинацию и проставьте голос.'}
                </p>
              </div>
              <Button view="outlined" onClick={() => setSearchParams({})}>Все голосования</Button>
            </div>

            {!nominations.length ? (
              <div className="status-block status-block-warning">
                <div className="status-title">Номинаций пока нет</div>
                <p className="text-muted mb-0">Возможно голосование не настроено или ещё не опубликовано.</p>
              </div>
            ) : (
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                {nominations.map((n) => (
                  <div className="col" key={n.id}>
                    <Link
                      to={`/nominations/${n.id}`}
                      className="nomination-tile text-decoration-none"
                    >
                      <div className="nomination-tile-inner">{n.title}</div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
