import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Label, Text } from '@gravity-ui/uikit';

import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import {
  isRateLimitError,
  useCastVote,
  useMyVotes,
  usePollInfo,
  useRevokeVote,
} from '../../../features/voting';
import {
  NOMINATION_KIND_LABELS,
  POLL_STATUS_META,
  RESULTS_VISIBILITY_META,
  VISIBILITY_META,
  formatDateTime,
  getScheduleMeta,
} from '../../../features/voting/utils/pollMeta';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { getLocale } from '@/shared/lib/locale';
import { toaster } from '../../../toaster';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { logger } from '../../../utils/logger';
import {
  VotingEmptyState,
  VotingErrorState,
  VotingLoadingState,
  VotingPageLayout,
  VotingRateLimitState,
} from '../ui';

export const PollPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const { user } = useAuth();
  const pollId = id ?? '';
  const locale = user?.language ?? getLocale();
  const hasCapabilities = Boolean(user?.capabilities?.length || user?.roles?.length);
  const canManage = Boolean(
    user?.isSuperuser || (!hasCapabilities ? true : can(user, ['voting.votings.admin', 'voting.nominations.admin'])),
  );

  const {
    data: info,
    isLoading: loadingInfo,
    isError: infoError,
    error: infoErrorData,
    refetch: refetchInfo,
  } = usePollInfo(pollId);

  const { data: myVotes = [], isLoading: loadingVotes, refetch: refetchVotes } = useMyVotes(pollId);

  const castVoteMutation = useCastVote({
    onSuccess: () => {
      logger.info('Voting v2 vote submitted', {
        area: 'voting',
        event: 'voting_v2.vote_submitted',
        data: { pollId },
      });
      toaster.add({ name: 'vote-success', title: 'Голос учтён', theme: 'success' });
    },
    onError: (error: unknown) => {
      if (isRateLimitError(error)) {
        logger.warn('Voting v2 rate limited on vote', {
          area: 'voting',
          event: 'voting_v2.error_rate_limit',
          data: { pollId, retryAfter: error.retryAfter },
        });
        toaster.add({
          name: 'rate-limit',
          title: `Слишком часто. Подождите ${error.retryAfter}s`,
          theme: 'warning',
        });
        return;
      }

      const code = (() => {
        if (!error || typeof error !== 'object') return null;
        const maybeBody = (error as { body?: unknown }).body;
        if (!maybeBody || typeof maybeBody !== 'object') return null;
        const maybeError = (maybeBody as { error?: unknown }).error;
        if (!maybeError || typeof maybeError !== 'object') return null;
        const maybeCode = (maybeError as { code?: unknown }).code;
        return typeof maybeCode === 'string' ? maybeCode : null;
      })();

      if (code === 'ALREADY_VOTED') {
        toaster.add({ name: 'already-voted', title: 'Вы уже голосовали за этот вариант', theme: 'warning' });
      } else {
        notifyApiError(error, 'Не удалось отправить голос');
      }
    },
  });

  const revokeVoteMutation = useRevokeVote({
    onSuccess: () => {
      toaster.add({ name: 'vote-revoked', title: 'Голос удалён', theme: 'info' });
    },
    onError: (error: unknown) => {
      if (isRateLimitError(error)) {
        toaster.add({
          name: 'rate-limit',
          title: `Слишком часто. Подождите ${error.retryAfter}s`,
          theme: 'warning',
        });
        return;
      }
      notifyApiError(error, 'Не удалось удалить голос');
    },
  });

  const loading = loadingInfo || loadingVotes;

  const votesByNomination = useMemo(() => {
    const map = new Map<string, typeof myVotes>();
    myVotes.forEach((vote) => {
      const list = map.get(vote.nomination_id) ?? [];
      list.push(vote);
      map.set(vote.nomination_id, list);
    });
    return map;
  }, [myVotes]);

  const retryAll = () => {
    refetchInfo();
    refetchVotes();
  };

  useEffect(() => {
    if (!info) return;
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'poll',
        pollId: info.poll.id,
        status: info.poll.status,
      },
    });
  }, [info]);

  if (loading && !info) {
    return <VotingLoadingState text="Загружаем опрос…" />;
  }

  if (infoError && !info) {
    if (isRateLimitError(infoErrorData)) {
      return <VotingRateLimitState retryAfter={infoErrorData.retryAfter} onRetry={retryAll} />;
    }

    return <VotingErrorState title="Не удалось загрузить опрос" onRetry={retryAll} />;
  }

  if (!info) {
    return (
      <VotingEmptyState
        title="Опрос не найден"
        action={
          <Button onClick={() => navigate(`${routeBase}/voting`)} view="action">
            Вернуться к списку
          </Button>
        }
      />
    );
  }

  const { poll, nominations, meta } = info;
  const statusMeta = POLL_STATUS_META[poll.status];
  const visibilityMeta = VISIBILITY_META[poll.visibility];
  const resultsMeta = RESULTS_VISIBILITY_META[poll.results_visibility];
  const scheduleMeta = getScheduleMeta(poll.starts_at, poll.ends_at);
  const scheduleLabel = scheduleMeta ? formatDateTime(scheduleMeta.at, locale) : null;

  const canVote = meta.can_vote && poll.status === 'active';
  const canRevote = poll.allow_revoting;

  const sortedNominations = [...nominations].sort((a, b) => a.sort_order - b.sort_order);

  const getVoteIdForOption = (nominationId: string, optionId: string) => {
    const votes = votesByNomination.get(nominationId) ?? [];
    return votes.find((vote) => vote.option_id === optionId)?.id ?? null;
  };

  const handleVote = (nominationId: string, optionId: string, maxVotes: number) => {
    if (!pollId) return;
    if (!canVote) {
      toaster.add({ name: 'vote-locked', title: 'Голосование недоступно', theme: 'warning' });
      return;
    }

    const votes = votesByNomination.get(nominationId) ?? [];
    if (votes.length >= maxVotes) {
      toaster.add({
        name: 'vote-limit',
        title: 'Достигнут лимит вариантов',
        content: `Можно выбрать максимум ${maxVotes}`,
        theme: 'warning',
      });
      return;
    }

    castVoteMutation.mutate({
      poll_id: pollId,
      nomination_id: nominationId,
      option_id: optionId,
    });
  };

  const handleRevokeVote = (voteId: string) => {
    if (!pollId) return;
    revokeVoteMutation.mutate({ voteId, pollId });
  };

  return (
    <VotingPageLayout
      title={poll.title}
      description={poll.description ?? 'Проголосуйте в каждой нужной категории и проверьте свои выборы.'}
      actions={
        <>
          <Button view="outlined" onClick={() => navigate(`${routeBase}/voting`)}>
            Назад
          </Button>
          {(poll.status === 'closed' || poll.results_visibility === 'always') && (
            <Link to={`${routeBase}/voting/${poll.id}/results`}>
              <Button view="action">Результаты</Button>
            </Link>
          )}
          {canManage && (
            <Link to={`${routeBase}/voting/${poll.id}/manage`}>
              <Button view="outlined">Управление</Button>
            </Link>
          )}
        </>
      }
    >
      <Card className="voting-v2__card voting-v2__card--soft">
        <div className="voting-v2__pills">
          <Label theme={statusMeta.theme} size="s" title={statusMeta.description}>
            {statusMeta.label}
          </Label>
          <Label theme={visibilityMeta.theme} size="s" title={visibilityMeta.description}>
            {visibilityMeta.label}
          </Label>
          <Label theme={resultsMeta.theme} size="s" title={resultsMeta.description}>
            {resultsMeta.label}
          </Label>
          {poll.anonymous ? <Label theme="utility" size="s">Анонимно</Label> : null}
          {poll.allow_revoting ? <Label theme="info" size="s">Переголосование</Label> : null}
        </div>
        {scheduleLabel ? (
          <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
            {scheduleMeta?.label}: {scheduleLabel}
          </Text>
        ) : null}
      </Card>

      {!canVote && poll.status === 'draft' ? (
        <Alert
          theme="warning"
          title="Опрос ещё не опубликован"
          message="Настройте вопросы и опубликуйте опрос, чтобы начать голосование."
        />
      ) : null}

      {!canVote && poll.status === 'closed' ? (
        <Alert
          theme="normal"
          title="Голосование завершено"
          message="Опрос закрыт. Доступны итоги и результаты."
        />
      ) : null}

      {!canVote && poll.status === 'active' ? (
        <Alert
          theme="warning"
          title="Голосование недоступно"
          message="У вас нет прав или голосование ещё не началось."
        />
      ) : null}

      <Card className="voting-v2__card">
        <div className="voting-v2__stats">
          <div className="voting-v2__stats-item">
            <span className="voting-v2__stats-label">Вопросов</span>
            <span className="voting-v2__stats-value">{sortedNominations.length}</span>
          </div>
          <div className="voting-v2__stats-item">
            <span className="voting-v2__stats-label">Ваш голос</span>
            <span className="voting-v2__stats-value">{meta.has_voted ? 'учтён' : 'ещё не подан'}</span>
          </div>
          <div className="voting-v2__stats-item">
            <span className="voting-v2__stats-label">Режим</span>
            <span className="voting-v2__stats-value">{poll.anonymous ? 'анонимно' : 'открыто'}</span>
          </div>
        </div>
      </Card>

      <div className="voting-v2__grid">
        {sortedNominations.map((nom) => {
          const options = nom.options ?? [];
          const votes = votesByNomination.get(nom.id) ?? [];
          const selectedCount = votes.length;
          const maxVotes = Math.max(1, nom.max_votes);

          return (
            <Card key={nom.id} className="voting-v2__card voting-v2__question" aria-label={nom.title}>
              <div className="voting-v2__question-head">
                <div>
                  <h2 className="voting-v2__question-title">{nom.title}</h2>
                  {nom.description ? (
                    <p className="voting-v2__question-description">{nom.description}</p>
                  ) : null}
                  <div className="voting-v2__pills">
                    <Label theme="normal" size="xs">{NOMINATION_KIND_LABELS[nom.kind]}</Label>
                    <Label theme="utility" size="xs">До {maxVotes} вариантов</Label>
                    {nom.is_required ? <Label theme="warning" size="xs">Обязательный</Label> : null}
                  </div>
                </div>
                <span className="voting-v2__small voting-v2__muted">Выбрано: {selectedCount}/{maxVotes}</span>
              </div>

              {options.length === 0 ? (
                <div className="voting-v2__state-card voting-v2__muted">
                  Варианты ещё не добавлены.
                </div>
              ) : (
                <div className="voting-v2__option-grid">
                  {options.map((option) => {
                    const voteId = getVoteIdForOption(nom.id, option.id);
                    const isSelected = Boolean(voteId);
                    const isVoting = castVoteMutation.isPending && castVoteMutation.variables?.option_id === option.id;
                    const isRevoking = revokeVoteMutation.isPending && revokeVoteMutation.variables?.voteId === voteId;
                    const disableByLimit = selectedCount >= maxVotes && !isSelected;
                    const isDisabled = !canVote || isVoting || isRevoking || disableByLimit;
                    const optionMetaId = `poll-option-${nom.id}-${option.id}-meta`;

                    return (
                      <div
                        key={option.id}
                        className={`voting-v2__option ${isSelected ? 'voting-v2__option--active' : ''}`}
                      >
                        <div>
                          <div className="voting-v2__option-title">{option.title}</div>
                          {option.description ? (
                            <div className="voting-v2__option-description">{option.description}</div>
                          ) : null}
                        </div>
                        <div className="voting-v2__option-footer">
                          {isSelected ? <Label theme="success" size="xs">Ваш выбор</Label> : <span />}
                          <Button
                            view={isSelected ? 'outlined' : 'action'}
                            size="s"
                            loading={isVoting || isRevoking}
                            disabled={isDisabled}
                            aria-pressed={isSelected}
                            aria-describedby={optionMetaId}
                            onClick={() => {
                              if (isSelected) {
                                if (!canRevote) {
                                  toaster.add({
                                    name: 'revote-disabled',
                                    title: 'Переголосование недоступно',
                                    theme: 'warning',
                                  });
                                  return;
                                }
                                if (voteId) {
                                  handleRevokeVote(voteId);
                                }
                                return;
                              }
                              handleVote(nom.id, option.id, maxVotes);
                            }}
                          >
                            {isSelected ? 'Снять выбор' : 'Выбрать'}
                          </Button>
                        </div>
                        <span id={optionMetaId} className="voting-v2__small voting-v2__muted">
                          {isSelected ? 'Выбран пользователем' : 'Не выбран'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </VotingPageLayout>
  );
};
