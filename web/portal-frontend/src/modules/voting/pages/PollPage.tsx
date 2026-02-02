import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Label, Loader, Text } from '@gravity-ui/uikit';

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
  POLL_STATUS_META,
  RESULTS_VISIBILITY_META,
  VISIBILITY_META,
  NOMINATION_KIND_LABELS,
  formatDateTime,
  getScheduleMeta,
} from '../../../features/voting/utils/pollMeta';
import { getLocale } from '../../../shared/lib/locale';
import { toaster } from '../../../toaster';
import { notifyApiError } from '../../../utils/apiErrorHandling';

export const PollPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const { data: myVotes = [], isLoading: loadingVotes } = useMyVotes(pollId);

  const castVoteMutation = useCastVote({
    onSuccess: () => {
      toaster.add({
        name: 'vote-success',
        title: 'Голос учтён',
        theme: 'success',
      });
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
      toaster.add({
        name: 'vote-revoked',
        title: 'Голос удалён',
        theme: 'info',
      });
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

  if (loading && !info) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (infoError && !info) {
    const isRateLimit = isRateLimitError(infoErrorData);
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">
            {isRateLimit ? 'Слишком много запросов' : 'Не удалось загрузить опрос'}
          </Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {isRateLimit
              ? `Подождите ${(infoErrorData as { retryAfter: number }).retryAfter} сек.`
              : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={() => refetchInfo()} view="action" width="max">
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2">Опрос не найден</Text>
          <Button onClick={() => navigate('/app/voting')} view="action" className="mt-4">
            Вернуться к списку
          </Button>
        </Card>
      </div>
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
    revokeVoteMutation.mutate({
      voteId,
      pollId,
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Label theme={statusMeta.theme} size="s" title={statusMeta.description}>
                  {statusMeta.label}
                </Label>
                <Label theme={visibilityMeta.theme} size="s" title={visibilityMeta.description}>
                  {visibilityMeta.label}
                </Label>
                <Label theme={resultsMeta.theme} size="s" title={resultsMeta.description}>
                  {resultsMeta.label}
                </Label>
                {poll.anonymous && <Label theme="utility" size="s">Анонимно</Label>}
                {poll.allow_revoting && <Label theme="info" size="s">Переголосование</Label>}
              </div>
              <div>
                <Text variant="header-1" className="text-slate-900">
                  {poll.title}
                </Text>
                {poll.description && (
                  <Text variant="body-2" color="secondary" className="mt-1">
                    {poll.description}
                  </Text>
                )}
              </div>
              {scheduleLabel && (
                <Text variant="body-2" color="secondary">
                  {scheduleMeta?.label}: {scheduleLabel}
                </Text>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button view="outlined" onClick={() => navigate('/app/voting')}
              >
                Назад
              </Button>
              {(poll.status === 'closed' || poll.results_visibility === 'always') && (
                <Link to={`/app/voting/${poll.id}/results`}>
                  <Button view="action">Результаты</Button>
                </Link>
              )}
              {canManage && (
                <Link to={`/app/voting/${poll.id}/manage`}>
                  <Button view="outlined">Управление</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {!canVote && poll.status === 'draft' && (
          <Alert
            theme="warning"
            title="Опрос ещё не опубликован"
            message="Настройте вопросы и опубликуйте опрос, чтобы начать голосование."
          />
        )}

        {!canVote && poll.status === 'closed' && (
          <Alert
            theme="normal"
            title="Голосование завершено"
            message="Опрос закрыт. Доступны итоги и результаты."
          />
        )}

        {!canVote && poll.status === 'active' && (
          <Alert
            theme="warning"
            title="Голосование недоступно"
            message="У вас нет прав или голосование ещё не началось."
          />
        )}

        <Card className="p-4">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">Вопросов:</span> {sortedNominations.length}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Ваш голос:</span> {meta.has_voted ? 'учтён' : 'ещё не подан'}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Режим:</span> {poll.anonymous ? 'анонимно' : 'открыто'}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          {sortedNominations.map((nom) => {
            const options = nom.options ?? [];
            const votes = votesByNomination.get(nom.id) ?? [];
            const selectedCount = votes.length;
            const maxVotes = Math.max(1, nom.max_votes);

            return (
              <Card key={nom.id} className="p-6 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <Text variant="subheader-2">{nom.title}</Text>
                    {nom.description && (
                      <Text variant="body-2" color="secondary">
                        {nom.description}
                      </Text>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <Label theme="normal" size="xs">{NOMINATION_KIND_LABELS[nom.kind]}</Label>
                      <Label theme="utility" size="xs">До {maxVotes} вариантов</Label>
                      {nom.is_required && <Label theme="warning" size="xs">Обязательный</Label>}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    Выбрано: {selectedCount}/{maxVotes}
                  </div>
                </div>

                {options.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Варианты ещё не добавлены.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {options.map((option) => {
                      const voteId = getVoteIdForOption(nom.id, option.id);
                      const isSelected = Boolean(voteId);
                      const isVoting = castVoteMutation.isPending && castVoteMutation.variables?.option_id === option.id;
                      const isRevoking = revokeVoteMutation.isPending && revokeVoteMutation.variables?.voteId === voteId;
                      const disableByLimit = selectedCount >= maxVotes && !isSelected;
                      const isDisabled = !canVote || isVoting || isRevoking || disableByLimit;

                      return (
                        <div
                          key={option.id}
                          className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 hover:border-slate-300'
                          } ${isDisabled && !isSelected ? 'opacity-60' : ''}`}
                        >
                          <div>
                            <div className="font-medium text-slate-900">{option.title}</div>
                            {option.description && (
                              <div className="text-sm text-slate-500 mt-1">{option.description}</div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            {isSelected && <Label theme="success" size="xs">Ваш выбор</Label>}
                            <Button
                              view={isSelected ? 'outlined' : 'action'}
                              size="s"
                              loading={isVoting || isRevoking}
                              disabled={isDisabled}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
