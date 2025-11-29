import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../api/client';
import { fetchVotingCatalog } from '../api/votings';
import type { VotingCatalogItem } from '../api/votings';
import {
  getApiErrorMeta,
  notifyApiError,
} from '../utils/apiErrorHandling';

type VoteStatus = 'active' | 'paused' | 'expired';

type DecoratedVoting = {
  id: string;
  title: string;
  description?: string;
  status: VoteStatus;
  deadline: Date | null;
  deadlineValue: number;
  palette: readonly [string, string];
  nominationCount: number;
  isOpen: boolean;
  isActive: boolean;
};

const accentPalettes: readonly [string, string][] = [
  ['#0094d9', '#7c5bff'],
  ['#ff6a00', '#ff9a3c'],
  ['#00a37a', '#00c6d9'],
  ['#0070c0', '#00b7ff'],
];

const updatesFeed = [
  {
    id: 'release',
    tone: 'success',
    title: 'AEF-Vote запустили как портал честных голосований',
    text: 'Рефреш главной, новая логика сортировки по дедлайнам и яркая витрина с голосованиями.',
    badge: 'новое',
  },
  {
    id: 'modules',
    tone: 'warning',
    title: 'Модуль уведомлений временно выключен',
    text: 'Пуши пока не раздаем: рассказываем прямо здесь, пока починим.',
    badge: 'ограничение',
  },
  {
    id: 'analytics',
    tone: 'info',
    title: 'Готовим аналитику по голосам',
    text: 'В планах графики и история изменений; пока показываем только финальные итоги.',
    badge: 'в разработке',
  },
];

const parseDeadline = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDeadline = (deadline: Date | null) => {
  if (!deadline) return 'Дедлайн не назначен';
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

const formatTimeLeft = (deadline: Date | null, status: VoteStatus, nowTs: number) => {
  if (!deadline) {
    return status === 'expired' ? 'Завершенно принудительно' : 'Дедлайн уточняется';
  }

  const diffMs = deadline.getTime() - nowTs;

  if (status === 'expired' || diffMs <= 0) {
    return `Завершено: ${deadline.toLocaleDateString('ru-RU', { dateStyle: 'medium' })}`;
  }

  const minutesTotal = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(minutesTotal / (60 * 24));
  const hours = Math.floor((minutesTotal - days * 24 * 60) / 60);

  if (days > 0) {
    return `Осталось ≈ ${days}д ${hours}ч`;
  }

  const restHours = Math.floor(minutesTotal / 60);
  if (restHours > 0) {
    return `Осталось ≈ ${restHours}ч`;
  }

  const restMinutes = Math.max(1, minutesTotal);
  return `Осталось минут: ${restMinutes}`;
};

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
    const now = nowTs;
    return votingCatalog.map((voting, index) => {
      const deadline = parseDeadline(voting.deadlineAt ?? null);
      const deadlineValue = deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const isExpired = deadline ? deadlineValue < now : false;
      const status: VoteStatus = isExpired
        ? 'expired'
        : voting.isOpen && voting.isActive
          ? 'active'
          : 'paused';

      return {
        id: voting.id,
        title: voting.title,
        description: voting.description ?? undefined,
        status,
        deadline,
        deadlineValue,
        palette: accentPalettes[index % accentPalettes.length],
        nominationCount: voting.nominationCount,
        isOpen: voting.isOpen,
        isActive: voting.isActive,
      };
    });
  }, [votingCatalog, nowTs]);

  const activeItems = useMemo(
    () => decoratedVotings
      .filter((item) => item.status !== 'expired')
      .sort((a, b) => a.deadlineValue - b.deadlineValue),
    [decoratedVotings],
  );

  const archivedItems = useMemo(
    () => decoratedVotings
      .filter((item) => item.status === 'expired')
      .sort((a, b) => a.deadlineValue - b.deadlineValue),
    [decoratedVotings],
  );

  const openVoting = (id: string) => navigate(`/votings/${id}`);

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    id: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openVoting(id);
    }
  };

  const renderVotingCard = (item: DecoratedVoting) => {
    const deadlineLabel = formatDeadline(item.deadline);
    const timeLeftLabel = formatTimeLeft(item.deadline, item.status, nowTs);
    const shortDeadline = item.deadline
      ? item.deadline.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })
      : 'без даты';

    return (
      <div
        key={item.id}
        className={`vote-card${item.status === 'expired' ? ' vote-card-expired' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openVoting(item.id)}
        onKeyDown={(event) => handleCardKeyDown(event, item.id)}
      >
        <div
          className="vote-card-cover"
          style={{
            background: `linear-gradient(135deg, ${item.palette[0]} 0%, ${item.palette[1]} 100%)`,
          }}
        >
          <div className="vote-card-cover-top">
            <span className={`vote-status vote-status-${item.status}`}>
              {statusLabel[item.status]}
            </span>
            <span className="vote-card-deadline-tag">
              {item.status === 'expired' ? 'финиш' : 'дедлайн'} · {shortDeadline}
            </span>
          </div>
          <div className="vote-card-cover-title">{item.title}</div>
        </div>

        <div className="vote-card-body">
          <div className="vote-card-title">{item.title}</div>
          <p className="vote-card-desc">
            {item.description ?? 'Кратко о голосовании, правила и обсуждение откроются позже.'}
          </p>
          <div className="vote-card-meta">
            <span className="text-muted small">
              {item.nominationCount} номинаций
            </span>
          </div>
          <div className="vote-card-footer">
            <div className="vote-card-meta">
              <div className="vote-card-deadline">{deadlineLabel}</div>
              <div className="vote-card-timer">{timeLeftLabel}</div>
            </div>
            <Button
              size="s"
              view={item.status === 'expired' ? 'flat-secondary' : 'outlined'}
              onClick={(event) => {
                event.stopPropagation();
                openVoting(item.id);
              }}
            >
              Открыть
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const featuredVotingId = useMemo(() => {
    if (activeItems.length) {
      const mainVoting = activeItems.find((item) => item.id === 'main');
      return mainVoting ? mainVoting.id : activeItems[0].id;
    }
    return decoratedVotings[0]?.id ?? null;
  }, [activeItems, decoratedVotings]);

  return (
    <div className="page-section home-page">
      <div className="container">
        <section className="home-hero">
          <div className="home-hero-kicker">AEF-Vote</div>
          <h1 className="home-hero-title">Портал Голосований</h1>
          <p className="home-hero-text">
            Создаем прозрачные условия честностных голосований внутри сообщества AEF.
          </p>
          <div className="home-hero-actions">
            <Button
              size="l"
              onClick={() => {
                if (featuredVotingId) {
                  openVoting(featuredVotingId);
                }
              }}
              disabled={!featuredVotingId}
            >
              К активным голосованиям
            </Button>
            <Button size="l" view="outlined" onClick={() => navigate('/profile')}>
              Профиль и сессии
            </Button>
          </div>
        </section>

        <section className="home-updates" aria-label="Изменения и новости">
          <div className="home-section-head">
            <div>
              <div className="home-section-title">Последние новости</div>
              {/* <div className="home-section-subtitle">
                Рассказываем что работает, а что в перспективе изменений
              </div> */}
            </div>
            {/* <span className="home-section-hint">Всегда наверху главной</span> */}
          </div>
          <div className="home-updates-grid">
            {updatesFeed.map((note) => (
              <Card key={note.id} className={`update-card update-card-${note.tone}`}>
                <div className="update-card-top">
                  <span className={`update-pill update-pill-${note.tone}`}>{note.badge}</span>
                  <span className="update-meta">AEF-Vote · портал</span>
                </div>
                <div className="update-title">{note.title}</div>
                <p className="update-text">{note.text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="home-section" aria-label="Актуальные голосования">
          <div className="home-section-head">
            <div>
              <div className="home-section-title">Актуальные голосования</div>
              {/* <div className="home-section-subtitle">
                Текущие потоки голосований, отсортированы по дате завершения
              </div> */}
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
            {activeItems.map((item) => renderVotingCard(item))}
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
              {archivedItems.map((item) => renderVotingCard(item))}
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
