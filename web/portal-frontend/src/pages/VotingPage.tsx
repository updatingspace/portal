import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../api/client';
import { fetchNominations } from '../api/nominations';
import type { Nomination } from '../data/nominations';
import { getApiErrorMeta, notifyApiError } from '../utils/apiErrorHandling';
import { logger } from '../utils/logger';

type VoteStatus = 'active' | 'paused' | 'expired';

const parseDeadline = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDeadline = (deadline: Date | null) => {
  if (!deadline) return null;
  return deadline.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const statusLabel: Record<VoteStatus, string> = {
  active: 'Активно',
  paused: 'На паузе',
  expired: 'Завершено',
};

export const VotingPage: React.FC = () => {
  const { votingId } = useParams<{ votingId: string }>();

  const [items, setItems] = useState<Nomination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const loadNominations = useCallback(async () => {
    if (!votingId) {
      return;
    }

    setIsLoading(true);
    setItems([]);
    setError(null);
    logger.info('Loading nominations', {
      area: 'nominations',
      event: 'load_list',
      data: { votingId },
    });

    try {
      const data = await fetchNominations(votingId);
      setItems(data);
      logger.info('Nominations loaded', {
        area: 'nominations',
        event: 'load_list',
        data: { votingId, count: data.length },
      });
    } catch (err) {
      notifyApiError(err, 'Не получилось загрузить номинации');
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [votingId]);

  useEffect(() => {
    loadNominations();
  }, [loadNominations]);

  const errorMeta = useMemo(
    () => (error ? getApiErrorMeta(error) : null),
    [error],
  );

  const votingInfo = items[0]?.voting ?? null;
  const votingDeadline = parseDeadline(votingInfo?.deadlineAt ?? null);
  const votingStatus: VoteStatus = useMemo(() => {
    if (!votingInfo) {
      return 'active';
    }

    if (votingDeadline && votingDeadline.getTime() < Date.now()) {
      return 'expired';
    }

    return votingInfo.isOpen && votingInfo.isActive ? 'active' : 'paused';
  }, [votingInfo, votingDeadline]);

  const deadlineLabel = formatDeadline(votingDeadline);

  return (
    <div className="page-section nominations-page">
      <div className="container">
        <div className="row">
          <section className="col-12 col-lg-10 mx-auto">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h1 className="page-title">
                  {votingInfo?.title ?? `Голосование ${votingId}`}
                </h1>
                <p className="text-muted mb-1">
                  {votingInfo?.description ?? 'Выберите номинацию и проставьте голос.'}
                </p>
                {deadlineLabel && (
                  <p className="text-muted small mb-0">
                    Дедлайн: {deadlineLabel}
                  </p>
                )}
              </div>
              <span className={`vote-status vote-status-${votingStatus}`}>
                {statusLabel[votingStatus]}
              </span>
            </div>

            {isLoading && !items.length ? (
              <div className="status-block status-block-info">
                <Loader size="l" />
                <div className="text-muted mt-2">Загружаем номинации...</div>
              </div>
            ) : error && !items.length ? (
              <div className="status-block status-block-danger">
                <div className="status-title">{errorMeta?.title ?? 'Не удалось загрузить голосование'}</div>
                <p className="text-muted mb-3">{errorMeta?.description}</p>
                <Button view="outlined" onClick={loadNominations}>
                  Попробовать еще раз
                </Button>
              </div>
            ) : items.length ? (
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                {items.map((nomination) => (
                  <div className="col" key={nomination.id}>
                    <Link
                      to={`/nominations/${nomination.id}`}
                      className="nomination-tile text-decoration-none"
                    >
                      <div className="nomination-tile-inner">
                        {nomination.title}
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="status-block status-block-warning">
                <div className="status-title">Номинаций пока нет</div>
                <p className="text-muted mb-0">
                  Возможно голосование не настроено или ещё не опубликовано.
                </p>
              </div>
            )}

            <div className="mt-4">
              {/* <Link to="/">← Назад к голосованиям</Link> */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
