import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../api/client';
import { fetchNomination, voteForOption } from '../api/nominations';
import type { Nomination } from '../data/nominations';
import {
  getApiErrorMeta,
  notifyApiError,
} from '../utils/apiErrorHandling';
import { logger } from '../utils/logger';
import { toaster } from '../toaster';
import { NominationHeader } from './NominationPage/components/NominationHeader';
import { OptionCard } from './NominationPage/components/OptionCard';
import { OptionGrid } from './NominationPage/components/OptionGrid';
import { OptionModal } from './NominationPage/components/OptionModal';
import { VoteCountsToggle } from './NominationPage/components/VoteCountsToggle';
import { VotingAlerts } from './NominationPage/components/VotingAlerts';
import type { VotingState } from './NominationPage/components/types';

const formatDeadline = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const DEFAULT_PAGE_SIZE = 6;

export const NominationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number> | null>(null);
  const [showVoteCounts, setShowVoteCounts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [modalOptionId, setModalOptionId] = useState<string | null>(null);

  const syncSelection = useCallback((optionId: string | null) => {
    setSelectedOptionId(optionId);
  }, []);

  const options = useMemo(
    () => nomination?.options ?? [],
    [nomination?.options],
  );
  const limitParam =
    searchParams.get('limit') ??
    searchParams.get('page_size') ??
    searchParams.get('pageSize');

  const displayLimit = useMemo(() => {
    if (!limitParam) return null;
    const parsed = Number.parseInt(limitParam, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [limitParam]);

  const pageSize = useMemo(
    () => Math.max(displayLimit ?? DEFAULT_PAGE_SIZE, 1),
    [displayLimit],
  );

  const pageCount = useMemo(
    () => (options.length ? Math.max(1, Math.ceil(options.length / pageSize)) : 1),
    [options.length, pageSize],
  );

  const currentPageIndex = Math.min(pageIndex, pageCount - 1);

  const visibleOptions = useMemo(
    () => {
      const start = currentPageIndex * pageSize;
      return options.slice(start, start + pageSize);
    },
    [options, pageSize, currentPageIndex],
  );


  const loadNomination = useCallback(async () => {
    if (!id) return;

    setNomination(null);
    setIsLoading(true);
    setError(null);
    setVoteCounts(null);
    setShowVoteCounts(false);
    syncSelection(null);
    setPageIndex(0);
    setModalOptionId(null);
    logger.info('Loading nomination', {
      area: 'nominations',
      event: 'load_nomination',
      data: { nominationId: id },
    });

    try {
      const data = await fetchNomination(id);
      setNomination(data);
      logger.info('Nomination loaded', {
        area: 'nominations',
        event: 'load_nomination',
        data: {
          nominationId: id,
          optionCount: data.options.length,
          votingId: data.voting?.id,
        },
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось загрузить номинацию');
      setError(err as ApiError);
      setNomination(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, syncSelection]);

  useEffect(() => {
    loadNomination();
  }, [loadNomination]);

  useEffect(() => {
    if (!nomination) return;

    const defaultSelection =
      nomination.userVote && options.some((opt) => opt.id === nomination.userVote)
        ? nomination.userVote
        : options[0]?.id ?? null;

    syncSelection(defaultSelection);
    setVoteCounts(nomination.counts ?? null);
    setShowVoteCounts(false);
    if (defaultSelection) {
      const defaultIndex = options.findIndex((opt) => opt.id === defaultSelection);
      if (defaultIndex >= 0) {
        setPageIndex(Math.floor(defaultIndex / pageSize));
      }
    }
  }, [nomination, options, pageSize, syncSelection]);

  useEffect(() => {
    if (!options.length) {
      if (selectedOptionId !== null) {
        syncSelection(null);
      }
      return;
    }

    if (selectedOptionId && !options.some((opt) => opt.id === selectedOptionId)) {
      syncSelection(options[0].id);
    }
  }, [options, selectedOptionId, syncSelection]);

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  useEffect(() => {
    if (!selectedOptionId) return;

    const optionIndex = options.findIndex((opt) => opt.id === selectedOptionId);
    if (optionIndex === -1) return;

    const optionPage = Math.floor(optionIndex / pageSize);
    setPageIndex((prev) => (prev === optionPage ? prev : optionPage));
  }, [selectedOptionId, options, pageSize]);

  const modalOption = useMemo(
    () => options.find((opt) => opt.id === modalOptionId) ?? null,
    [options, modalOptionId],
  );

  useEffect(() => {
    if (!modalOptionId) return;

    if (!options.some((opt) => opt.id === modalOptionId)) {
      setModalOptionId(null);
    }
  }, [modalOptionId, options]);

  useEffect(() => {
    if (!voteCounts) {
      setShowVoteCounts(false);
    }
  }, [voteCounts]);

  const handleVote = async (optionId: string) => {
    if (!id || !nomination) {
      return;
    }

    const votingClosed = nomination.isVotingOpen === false;
    const canVoteNow = nomination.canVote ?? false;

    if (votingClosed) {
      logger.info('Vote attempt blocked: voting closed', {
        area: 'nominations',
        event: 'vote_blocked',
        data: { nominationId: id, reason: 'closed' },
      });
      toaster.add({
        name: `vote-locked-${Date.now()}`,
        theme: 'warning',
        title: 'Голосование завершено',
        content: 'Дедлайн прошёл, изменить выбор уже нельзя.',
        autoHiding: 4500,
      });
      return;
    }

    if (!canVoteNow) {
      logger.warn('Vote attempt blocked: not allowed', {
        area: 'nominations',
        event: 'vote_blocked',
        data: {
          nominationId: id,
          reason: needsTelegramLink ? 'telegram_required' : 'unauthorized',
        },
      });
      toaster.add({
        name: `vote-auth-${Date.now()}`,
        theme: 'warning',
        title: needsTelegramLink ? 'Нужна привязка Telegram' : 'Требуется вход',
        content: needsTelegramLink
          ? 'Привяжите Telegram в профиле, чтобы проголосовать.'
          : 'Авторизуйтесь в профиле, чтобы отдать голос.',
        autoHiding: 4500,
      });
      return;
    }

    syncSelection(optionId);
    setIsVoting(true);
    logger.info('Submitting vote', {
      area: 'nominations',
      event: 'vote_submit',
      data: { nominationId: id, optionId },
    });

    try {
      const response = await voteForOption({ nominationId: id, optionId });
      const nextCounts = response.counts ?? null;
      setVoteCounts(nextCounts);
      setNomination((prev) =>
        prev
          ? {
              ...prev,
              userVote: optionId,
              counts: nextCounts ?? undefined,
              isVotingOpen: response.isVotingOpen,
              canVote: response.canVote,
              requiresTelegramLink:
                response.requiresTelegramLink ?? prev.requiresTelegramLink,
              votingDeadline: response.votingDeadline ?? prev.votingDeadline,
            }
          : prev,
      );
      logger.info('Vote submitted', {
        area: 'nominations',
        event: 'vote_submit',
        data: {
          nominationId: id,
          optionId,
          countsReturned: Boolean(nextCounts),
          votingOpen: response.isVotingOpen,
        },
      });

      toaster.add({
        name: `vote-${Date.now()}`,
        theme: 'success',
        title: 'Голос учтен',
        content: 'Спасибо! Счетчики обновлены для выбранной опции.',
        autoHiding: 4000,
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось отправить голос');
    } finally {
      setIsVoting(false);
    }
  };

  if (!nomination) {
    const errorMeta = error ? getApiErrorMeta(error) : null;

    if (isLoading) {
      return (
        <div className="page-section">
          <div className="container">
            <div className="status-block status-block-info">
              <Loader size="l" />
              <div className="text-muted mt-2">Загружаем номинацию...</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="page-section">
        <div className="container">
          <div className="status-block status-block-danger">
            <div className="status-title">
              {errorMeta?.title ?? 'Номинация не найдена'}
            </div>
            <p className="text-muted mb-3">
              {errorMeta?.description ?? 'Проверьте ссылку или вернитесь к списку.'}
            </p>
              <div className="d-flex gap-2">
                <Button view="outlined" onClick={loadNomination}>
                  Попробовать еще раз
                </Button>
                <Link to="/">← Назад к голосованиям</Link>
              </div>
          </div>
        </div>
      </div>
    );
  }

  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pageCount - 1;
  const isVotingClosed = nomination.isVotingOpen === false;
  const needsTelegramLink = nomination.requiresTelegramLink ?? false;
  const canVoteNow = (nomination.canVote ?? false) && !needsTelegramLink;
  const disableVoting = isVotingClosed || !canVoteNow;
  const deadlineLabel = formatDeadline(nomination.votingDeadline);
  const hasVoteCounts = voteCounts !== null;
  const shouldShowVoteCounts = hasVoteCounts && showVoteCounts;
  const optionVotes = (optionId: string) => voteCounts?.[optionId] ?? 0;

  const votingState: VotingState = {
    isVoting,
    isVotingClosed,
    canVoteNow,
    needsTelegramLink,
    disableVoting,
  };

  const handlePrev = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setPageIndex((prev) => Math.min(prev + 1, pageCount - 1));
  };

  const openOptionModal = (optionId: string) => {
    setModalOptionId(optionId);
  };

  const handleModalClose = () => setModalOptionId(null);

  const votesListLink = nomination?.voting?.id
    ? `/votings/${nomination.voting.id}`
    : '/';

  const handleOptionVote = (optionId: string) => {
    syncSelection(optionId);
    handleVote(optionId);
  };

  const optionCards = visibleOptions.map((option) => (
    <OptionCard
      key={option.id}
      option={option}
      isUserChoice={nomination.userVote === option.id}
      votingState={votingState}
      shouldShowVoteCounts={shouldShowVoteCounts}
      voteCount={optionVotes(option.id)}
      onVote={handleOptionVote}
      onOpenModal={openOptionModal}
    />
  ));

  const modalIsUserChoice = modalOption ? nomination.userVote === modalOption.id : false;

  return (
    <div className="page-section nomination-page">
      <div className="container">
        <div className="row">
          <section className="col-12 col-lg-10 mx-auto">
            <NominationHeader
              nomination={nomination}
              votesListLink={votesListLink}
            />

            <VotingAlerts
              isVotingClosed={isVotingClosed}
              deadlineLabel={deadlineLabel}
              canVoteNow={canVoteNow}
              needsTelegramLink={needsTelegramLink}
            />

            <VoteCountsToggle
              hasVoteCounts={hasVoteCounts}
              showVoteCounts={showVoteCounts}
              onToggle={setShowVoteCounts}
            />

            <OptionGrid
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={handlePrev}
              onNext={handleNext}
              pageCount={pageCount}
              currentPageIndex={currentPageIndex}
            >
              {optionCards}
            </OptionGrid>
            <OptionModal
              option={modalOption}
              votingState={votingState}
              shouldShowVoteCounts={shouldShowVoteCounts}
              voteCount={modalOption ? optionVotes(modalOption.id) : 0}
              isUserChoice={modalIsUserChoice}
              isOpen={Boolean(modalOption)}
              onClose={handleModalClose}
              onVote={handleOptionVote}
            />
          </section>
        </div>
      </div>
    </div>
  );
};
