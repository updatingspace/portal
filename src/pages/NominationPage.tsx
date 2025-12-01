import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button, Card, Checkbox, Dialog, Loader, Select } from '@gravity-ui/uikit';

import type { ApiError } from '../api/client';
import { fetchNomination, voteForOption } from '../api/nominations';
import type { Nomination } from '../data/nominations';
import {
  getApiErrorMeta,
  notifyApiError,
} from '../utils/apiErrorHandling';
import { toaster } from '../toaster';

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
  const [quickSelectValue, setQuickSelectValue] = useState<string[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number> | null>(null);
  const [showVoteCounts, setShowVoteCounts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [modalOptionId, setModalOptionId] = useState<string | null>(null);

  const syncSelection = useCallback((optionId: string | null) => {
    setSelectedOptionId(optionId);
    setQuickSelectValue(optionId ? [optionId] : []);
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

  const selectedOption = useMemo(
    () => {
      if (!selectedOptionId) return null;
      return options.find((opt) => opt.id === selectedOptionId) ?? null;
    },
    [options, selectedOptionId],
  );

  const savedVoteTitle = useMemo(
    () => options.find((opt) => opt.id === nomination?.userVote)?.title,
    [options, nomination?.userVote],
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

    try {
      const data = await fetchNomination(id);
      setNomination(data);
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

  const quickSelectDisabled = disableVoting || isVoting;
  const quickSelectHint = isVotingClosed
    ? 'Голосование закрыто, кнопки неактивны.'
    : canVoteNow
      ? 'Отмечайте фаворита и отправляйте голос.'
      : needsTelegramLink
        ? 'Привяжите Telegram в профиле, чтобы голосовать.'
        : 'Авторизуйтесь, чтобы проголосовать.';

  const handlePrev = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setPageIndex((prev) => Math.min(prev + 1, pageCount - 1));
  };

  const openOptionModal = (optionId: string) => {
    setModalOptionId(optionId);
  };

  const modalIsUserChoice = modalOption ? nomination.userVote === modalOption.id : false;
  const showModalMeta = shouldShowVoteCounts || modalIsUserChoice;

  const modalVoteLabel = (() => {
    if (isVoting) return 'Отправляем...';
    if (isVotingClosed) return 'Голосование завершено';
    if (!canVoteNow) return needsTelegramLink ? 'Привяжите Telegram' : 'Нужна авторизация';
    return 'Отдать голос за эту игру';
  })();

  const handleModalClose = () => setModalOptionId(null);

  const handleModalVote = () => {
    if (!modalOption || disableVoting || isVoting) return;
    syncSelection(modalOption.id);
    handleVote(modalOption.id);
    handleModalClose();
  };

  const votesListLink = nomination?.voting?.id
    ? `/votings/${nomination.voting.id}`
    : '/';

  return (
    <div className="page-section nomination-page">
      <div className="container">
        <div className="row">
          
          <section className="col-12 col-lg-10 mx-auto">
            <div className="mt-3">
              <Link to={votesListLink}>← Назад к голосованиям</Link>
            </div>
            <h1 className="page-title">{nomination.title}</h1>
            <p className="text-muted">
              В ходе данного голосования вам доступен выбор одной игры из представленных вариантов.
              После выбора и подтверждения ваш голос будет зафиксирован и учтен в общем счете. 
              Изменения в своем голосе вы можете осуществлять до завершения процедуры голосования.
            </p>

            {nomination.description && (
              <p className="mb-3">{nomination.description}</p>
            )}

            {isVotingClosed && (
              <div className="status-block status-block-warning">
                <div className="status-title">Голосование завершено</div>
                <p className="text-muted mb-0">
                  {deadlineLabel ? `Дедлайн: ${deadlineLabel}. ` : ''}
                  Кнопки для отправки голоса отключены, карточки можно листать.
                </p>
              </div>
            )}

            {!isVotingClosed && !canVoteNow && (
              <div className="status-block status-block-warning">
                <div className="status-title">
                  {needsTelegramLink ? 'Нужна привязка Telegram' : 'Требуется авторизация'}
                </div>
                <p className="text-muted mb-0">
                  {needsTelegramLink ? (
                    <>
                      Привяжите Telegram во вкладке «Профиль», чтобы участвовать в голосовании.
                      {' '}
                      <Link to="/profile">Открыть профиль</Link>
                    </>
                  ) : (
                    'Войдите во вкладке «Профиль», чтобы проголосовать. Пока можно изучить варианты.'
                  )}
                </p>
              </div>
            )}

            <Card className="quick-vote-card">
               <div className="quick-vote-top">
                <div>
                  <div className="quick-vote-title">Быстрый выбор одной игры</div>
                  <div className="text-muted small">{quickSelectHint}</div>
                </div>
                {deadlineLabel && (
                  <div className="quick-vote-deadline text-muted small">
                    Дедлайн: {deadlineLabel}
                  </div>
                )}
              </div>

              <div className="quick-vote-controls">
                <div className="flex-grow-1 min-w-0 quick-vote-select">
                  <Select
                    size="l"
                    placeholder="Выберите игру"
                    disabled={quickSelectDisabled}
                    options={options.map((option) => ({
                      value: option.id,
                      content: option.title,
                    }))}
                    value={quickSelectValue}
                    onUpdate={(value) => syncSelection(value[0] ?? null)}
                  />
                </div>
                <Button
                  view="action"
                  size="l"
                  disabled={quickSelectDisabled || !selectedOptionId}
                  onClick={() => selectedOptionId && handleVote(selectedOptionId)}
                >
                  {isVotingClosed
                    ? 'Голосование завершено'
                    : canVoteNow
                      ? isVoting
                        ? 'Отправляем...'
                        : 'Отдать голос игре'
                      : needsTelegramLink
                        ? 'Привяжите Telegram'
                        : 'Нужна авторизация'}
                </Button>
              </div>

              <div className="quick-vote-footer text-muted small">
                {savedVoteTitle
                  ? `Ваш текущий выбор: ${savedVoteTitle}.`
                  : selectedOption
                    ? `Сейчас выбран вариант: ${selectedOption.title}.`
                    : 'Выберите фаворита, чтобы сохранить голос.'}
              </div>
            </Card>

            {hasVoteCounts && (
                <div className="mb-3">
                  <Checkbox
                    size="m"
                    checked={showVoteCounts}
                    onUpdate={setShowVoteCounts}
                  >
                    Посмотреть количество голосов
                  </Checkbox>
                </div>
              )}

            <div className="option-grid-shell my-4">
              <div className="d-flex align-items-center gap-3 option-grid-shell-row">
                <Button onClick={handlePrev} disabled={!canGoPrev}>
                  {'<'}
                </Button>

                <div className="option-grid option-grid-roomy">
                  {visibleOptions.map((option) => {
                    const isUserChoice = nomination.userVote === option.id;

                    const voteButtonLabel = (() => {
                      if (isVoting) return 'Отправляем...';
                      if (isVotingClosed) return 'Голосование завершено';
                      if (!canVoteNow) return needsTelegramLink ? 'Привяжите Telegram' : 'Нужна авторизация';
                      if (isUserChoice) return 'Обновить голос';
                      return 'Проголосовать';
                    })();

                    return (
                      <Card
                        key={option.id}
                        type="action"
                        className="option-card"
                        onClick={() => openOptionModal(option.id)}
                      >
                        <div className="option-card-cover">
                          {(option.imageUrl || option.game?.imageUrl) ? (
                            <img
                              src={option.imageUrl ?? option.game?.imageUrl ?? undefined}
                              alt={`Обложка игры ${option.title}`}
                              className="option-card-cover-img"
                            />
                          ) : (
                            <div className="option-card-cover-placeholder">
                              <span className="option-card-cover-accent">Кадр игры</span>
                              <span className="option-card-cover-note">
                                оно не нашлось, но мы уже добавляем живое превью.
                              </span>
                            </div>
                          )}
                          <div className="option-card-badge">{option.game?.genre ? `Жанр: ${option.game.genre}` : 'Жанр - ?'}</div>
                        </div>
                        <div className="option-card-footer">
                          <div className="option-card-header">
                            <div className="option-card-title">{option.title}</div>
                            {shouldShowVoteCounts && (
                              <div className="option-card-votes text-muted">
                                Голосов: {optionVotes(option.id)}
                              </div>
                            )}
                          </div>
                          <div className="option-card-description text-muted small">
                            {option.game?.description ?? 'Описание игры пока не добавлено.'}
                          </div>
                          <div className="option-card-subtitle text-muted">
                            {isUserChoice
                              ? 'Этот вариант уже привязан к вашему аккаунту.'
                              : 'Клик откроет подробную модалку с описанием.'}
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              syncSelection(option.id);
                              handleVote(option.id);
                            }}
                            disabled={disableVoting || isVoting}
                            view={isUserChoice ? 'action' : 'outlined'}
                            size="l"
                            width="max"
                          >
                            {voteButtonLabel}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <Button onClick={handleNext} disabled={!canGoNext}>
                  {'>'}
                </Button>
              </div>
              {pageCount > 1 && (
                <div className="option-grid-page text-muted small">
                  Страница {currentPageIndex + 1} из {pageCount}
                </div>
              )}
            </div>

            {modalOption && (
              <Dialog
                open={Boolean(modalOption)}
                size="l"
                contentOverflow="auto"
                onClose={handleModalClose}
                onOpenChange={(open) => {
                  if (!open) {
                    handleModalClose();
                  }
                }}
              >
                <Dialog.Header caption="Карточка игры" />
                <Dialog.Body>
                  <div className="option-modal-body">
                    <div className="option-modal-media">
                      {modalOption.imageUrl ? (
                        <img
                          src={modalOption.imageUrl}
                          alt={`Обложка игры ${modalOption.title}`}
                          className="option-modal-cover-img"
                        />
                      ) : (
                        <div className="option-modal-cover-placeholder">
                          <span className="option-card-cover-accent">Обложка игры</span>
                          <span className="option-card-cover-note">
                            Добавим живое превью из API.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="option-modal-content">
                      <div className="option-modal-title">{modalOption.title}</div>
                      {showModalMeta && (
                        <div className="option-modal-meta">
                          {shouldShowVoteCounts && (
                            <span className="option-modal-votes">
                              Голосов: {optionVotes(modalOption.id)}
                            </span>
                          )}
                          {modalIsUserChoice && (
                            <span className="option-modal-badge option-modal-badge-success">
                              Ваш голос
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-muted">
                        {modalOption.game?.studio || 'Студия не указана'} ·{' '}
                        {modalOption.game?.genre ?? 'Жанр не указан'}
                      </p>
                      <div className="option-card-description text-muted">
                        {modalOption.game?.description ?? 'Описание игры пока не добавлено.'}
                      </div>
                      <ul className="option-modal-list text-muted">
                        {modalOption.game?.releaseYear && (
                          <li>Год релиза: {modalOption.game.releaseYear}</li>
                        )}
                        {modalOption.game?.title && (
                          <li>Название: {modalOption.game.title}</li>
                        )}
                        {modalOption.game?.studio && (
                          <li>Разработчик: {modalOption.game.studio}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </Dialog.Body>
                <Dialog.Footer
                  textButtonApply={modalVoteLabel}
                  propsButtonApply={{ view: 'action', disabled: disableVoting || isVoting }}
                  onClickButtonApply={handleModalVote}
                  textButtonCancel="Закрыть"
                  onClickButtonCancel={handleModalClose}
                />
              </Dialog>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
