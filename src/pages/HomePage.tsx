import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../api/client';
import { HomePageModalDisplay } from '../components/HomePageModalDisplay';
import { fetchVotingCatalog } from '../api/votings';
import type { VotingCatalogItem } from '../api/votings';
import {
  getApiErrorMeta,
  notifyApiError,
} from '../utils/apiErrorHandling';
import { accentPalettes, voteStages } from './HomePage/constants';
import { HomeHero } from './HomePage/components/HomeHero';
import { StagesSection } from './HomePage/components/StagesSection';
import { VotingCard } from './HomePage/components/VotingCard';
import { formatDeadline, parseDeadline } from './HomePage/utils';
import type { DecoratedVoting, VoteStatus } from './HomePage/types';

const MAX_ACTIVE_ITEMS = 20;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const [votingCatalog, setVotingCatalog] = useState<VotingCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  const loadVotingCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const catalog = await fetchVotingCatalog();
      setVotingCatalog(catalog);
    } catch (err) {
      notifyApiError(err, 'Не получилось загрузить голосования');
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVotingCatalog();
  }, [loadVotingCatalog]);

  const errorMeta = useMemo(
    () => (error ? getApiErrorMeta(error) : null),
    [error],
  );

  const decoratedVotings = useMemo<DecoratedVoting[]>(() => {
    return votingCatalog.map((voting, index) => {
      const deadline = parseDeadline(voting.deadlineAt ?? null);
      const deadlineValue = deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const isActive = Boolean(voting.isActive);
      const isOpen = Boolean(voting.isOpen);
      const status: VoteStatus = isActive ? (isOpen ? 'active' : 'finished') : 'archived';

      return {
        id: voting.id,
        title: voting.title,
        description: voting.description ?? undefined,
        imageUrl: voting.imageUrl ?? undefined,
        status,
        deadline,
        deadlineValue,
        palette: accentPalettes[index % accentPalettes.length],
        nominationCount: voting.nominationCount,
        isOpen: voting.isOpen,
        isActive: voting.isActive,
      };
    });
  }, [votingCatalog]);

  const activeItems = useMemo(() => {
    const sorted = decoratedVotings
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.deadlineValue - b.deadlineValue);
    return sorted.slice(0, MAX_ACTIVE_ITEMS);
  }, [decoratedVotings]);

  const archivedItems = useMemo(
    () =>
      decoratedVotings
        .filter((item) => item.status !== 'active')
        .sort((a, b) => a.deadlineValue - b.deadlineValue),
    [decoratedVotings],
  );

  const nextDeadlineItem = useMemo(
    () => activeItems.find((item) => item.deadline) ?? null,
    [activeItems],
  );

  const nextDeadlineLabel = nextDeadlineItem
    ? formatDeadline(nextDeadlineItem.deadline)
    : 'Дедлайн уточняется';

  const openVoting = (id: string) => navigate(`/votings/${id}`);

  return (
    <div className="page-section home-page">
      <HomePageModalDisplay />
      <div className="container">
        <HomeHero
          activeCount={activeItems.length}
          archivedCount={archivedItems.length}
          nextDeadlineLabel={nextDeadlineLabel}
        />

        <StagesSection stages={voteStages} />

        <section className="home-section" aria-label="Актуальные голосования">
          <div className="home-section-head">
            <div>
              <div className="home-section-title">Актуальные голосования</div>
            </div>
            <div className="home-section-actions">
              {isLoading ? <Loader size="s" /> : null}
              <Button
                view="flat-secondary"
                size="m"
                onClick={loadVotingCatalog}
                disabled={isLoading}
              >
                Обновить список
              </Button>
            </div>
          </div>

          {isLoading && !decoratedVotings.length ? (
            <div className="status-block status-block-info">
              <Loader size="m" />
              <div className="text-muted mt-2">Подтягиваем голосования...</div>
            </div>
          ) : error && !decoratedVotings.length ? (
            <div className="status-block status-block-danger">
              <div className="status-title">
                {errorMeta?.title ?? 'Не удалось загрузить голосования'}
              </div>
              <p className="text-muted mb-3">
                {errorMeta?.description ?? 'Попробуйте обновить страницу или зайти позже.'}
              </p>
              <Button view="outlined" onClick={loadVotingCatalog}>
                Попробовать еще раз
              </Button>
            </div>
          ) : activeItems.length ? (
            <div className="vote-grid">
              {activeItems.map((item) => (
                <VotingCard key={item.id} item={item} nowTs={nowTs} onOpen={openVoting} />
              ))}
            </div>
          ) : (
            <div className="status-block status-block-warning">
              <div className="status-title">Активных голосований пока нет</div>
              <p className="text-muted mb-0">
                Как только появится новое голосование, оно всплывет здесь первым в списке.
              </p>
            </div>
          )}
        </section>

        <section className="home-section" aria-label="Завершенные голосования">
          <div className="home-section-head">
            <div>
              <div className="home-section-title">Завершенные</div>
              <div className="home-section-subtitle">
                Архивные голосования и завершённые серии
              </div>
            </div>
          </div>

          {isLoading && !decoratedVotings.length ? (
            <div className="status-block status-block-info">
              <Loader size="m" />
              <div className="text-muted mt-2">Загружаем архив...</div>
            </div>
          ) : archivedItems.length ? (
            <div className="vote-grid">
              {archivedItems.map((item) => (
                <VotingCard key={item.id} item={item} nowTs={nowTs} onOpen={openVoting} />
              ))}
            </div>
          ) : (
            <div className="status-block status-block-info">
              <div className="status-title">Архив пуст</div>
              <p className="text-muted mb-0">
                Пока ни одно голосование не завершилось — следите за верхним списком.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
