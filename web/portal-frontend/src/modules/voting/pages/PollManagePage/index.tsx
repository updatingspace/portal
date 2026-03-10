import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Label,
  Modal,
  Select,
  Text,
  TextArea,
  TextInput,
} from '@gravity-ui/uikit';

import { isApiError } from '../../../../api/client';
import { NominationForm } from '../../../../features/voting/components/NominationForm';
import { OptionForm } from '../../../../features/voting/components/OptionForm';
import { ScheduleForm } from '../../../../features/voting/components/ScheduleForm';
import type {
  NominationKind,
  NominationWithOptions,
  Option,
  OptionCreatePayload,
  PollRole,
  PollVisibility,
  ResultsVisibility,
} from '../../../../features/voting/types';
import {
  useAddParticipant,
  useCreateNomination,
  useCreateOption,
  useDeleteNomination,
  useDeleteOption,
  useDeletePoll,
  usePollInfo,
  usePollParticipants,
  useRemoveParticipant,
  useUpdateNomination,
  useUpdateOption,
  useUpdatePoll,
} from '../../../../features/voting';
import { toaster } from '../../../../toaster';
import { notifyApiError } from '../../../../utils/apiErrorHandling';
import type {
  NominationCreatePayload,
  NominationUpdatePayload,
  PollUpdatePayload,
} from '../../../../features/voting/types';
import {
  NOMINATION_KIND_LABELS,
  POLL_STATUS_META,
  RESULTS_VISIBILITY_META,
  SCOPE_LABELS,
  VISIBILITY_META,
  formatDateTime,
} from '../../../../features/voting/utils/pollMeta';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { getLocale } from '@/shared/lib/locale';
import { useAuth } from '../../../../contexts/AuthContext';
import { logger } from '../../../../utils/logger';
import type { VotingConfirmAction } from '../../ui';
import { VotingConfirmDialog, VotingErrorState, VotingLoadingState, VotingPageLayout } from '../../ui';

const VISIBILITY_OPTIONS = [
  { value: 'public', content: 'Публичный' },
  { value: 'community', content: 'Сообщество' },
  { value: 'team', content: 'Команда' },
  { value: 'private', content: 'Приватный' },
];

const RESULTS_OPTIONS = [
  { value: 'always', content: 'Всегда доступны' },
  { value: 'after_closed', content: 'После закрытия' },
  { value: 'admins_only', content: 'Только администраторам' },
];

const PARTICIPANT_OPTIONS = [
  { value: 'participant', content: 'Участник' },
  { value: 'observer', content: 'Наблюдатель' },
  { value: 'moderator', content: 'Модератор' },
  { value: 'admin', content: 'Администратор' },
];

export const PollManagePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const location = useLocation();
  const { user } = useAuth();
  const pollId = id ?? '';
  const locale = user?.language ?? getLocale();

  const { data: pollInfo, isLoading, isError, error, refetch } = usePollInfo(pollId);
  const { data: participants = [] } = usePollParticipants(pollId);

  const updatePollMutation = useUpdatePoll();
  const deletePollMutation = useDeletePoll();
  const createNominationMutation = useCreateNomination();
  const updateNominationMutation = useUpdateNomination();
  const deleteNominationMutation = useDeleteNomination();
  const createOptionMutation = useCreateOption();
  const updateOptionMutation = useUpdateOption();
  const deleteOptionMutation = useDeleteOption();
  const addParticipantMutation = useAddParticipant();
  const removeParticipantMutation = useRemoveParticipant();

  const initialTab = (location.state as { tab?: string } | null | undefined)?.tab;
  const [activeTab, setActiveTab] = useState<'settings' | 'questions' | 'participants'>(
    initialTab === 'questions' || initialTab === 'participants' ? initialTab : 'settings',
  );

  const [settingsDraft, setSettingsDraft] = useState<{
    title: string;
    description: string;
    visibility: PollVisibility;
    allow_revoting: boolean;
    anonymous: boolean;
    results_visibility: ResultsVisibility;
    starts_at: string | null;
    ends_at: string | null;
  } | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [createQuestionOpen, setCreateQuestionOpen] = useState(false);
  const [editingNomination, setEditingNomination] = useState<{
    nominationId: string;
    title: string;
    description: string;
    kind: NominationKind;
    max_votes: number;
    is_required: boolean;
    sort_order: number;
  } | null>(null);
  const [optionEditor, setOptionEditor] = useState<
    | {
        mode: 'create';
        nominationId: string;
        payload: OptionCreatePayload;
      }
    | {
        mode: 'edit';
        nominationId: string;
        optionId: string;
        payload: OptionCreatePayload;
      }
    | null
  >(null);

  const [participantUserId, setParticipantUserId] = useState('');
  const [participantRole, setParticipantRole] = useState<PollRole>('participant');
  const [confirmAction, setConfirmAction] = useState<VotingConfirmAction | null>(null);

  useEffect(() => {
    if (!pollInfo) return;
    if (settingsDirty) return;
    const { poll } = pollInfo;
    // Keep local draft in sync with latest poll data while form is clean.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsDraft({
      title: poll.title,
      description: poll.description ?? '',
      visibility: poll.visibility,
      allow_revoting: Boolean(poll.allow_revoting),
      anonymous: Boolean(poll.anonymous),
      results_visibility: poll.results_visibility,
      starts_at: poll.starts_at ?? null,
      ends_at: poll.ends_at ?? null,
    });
  }, [pollInfo, settingsDirty]);

  useEffect(() => {
    if (!pollInfo) return;
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'manage',
        pollId: pollInfo.poll.id,
        status: pollInfo.poll.status,
      },
    });
  }, [pollInfo]);

  const poll = pollInfo?.poll;
  const nominations = useMemo(() => pollInfo?.nominations ?? [], [pollInfo?.nominations]);

  const sortedNominations = useMemo(() => {
    return [...nominations].sort((a, b) => a.sort_order - b.sort_order);
  }, [nominations]);

  const publishIssues = useMemo(() => {
    const issues: string[] = [];
    if (sortedNominations.length === 0) {
      issues.push('Добавьте хотя бы один вопрос.');
    }
    for (const nomination of sortedNominations) {
      if (!nomination.options || nomination.options.length === 0) {
        issues.push(`Вопрос «${nomination.title}» должен иметь хотя бы один вариант.`);
      }
    }
    return issues;
  }, [sortedNominations]);

  const isDraft = poll?.status === 'draft';
  const isActive = poll?.status === 'active';
  const canPublish = Boolean(isDraft && publishIssues.length === 0);
  const statusMeta = poll ? POLL_STATUS_META[poll.status] : POLL_STATUS_META.draft;
  const visibilityMeta = poll ? VISIBILITY_META[poll.visibility] : VISIBILITY_META.public;
  const resultsMeta = poll ? RESULTS_VISIBILITY_META[poll.results_visibility] : RESULTS_VISIBILITY_META.after_closed;

  if (isLoading) {
    return <VotingLoadingState text="Загружаем настройки опроса…" />;
  }

  if (isError || !pollInfo || !poll) {
    return (
      <VotingErrorState
        title="Не удалось загрузить опрос"
        message={error instanceof Error ? error.message : 'Попробуйте снова.'}
        onRetry={() => refetch()}
      />
    );
  }

  const confirmLoading =
    deletePollMutation.isPending ||
    updatePollMutation.isPending ||
    deleteOptionMutation.isPending ||
    deleteNominationMutation.isPending ||
    removeParticipantMutation.isPending;

  const openConfirm = (action: VotingConfirmAction) => {
    setConfirmAction(action);
  };

  const closeConfirm = () => {
    if (confirmLoading) return;
    setConfirmAction(null);
  };

  const saveSettings = () => {
    if (!settingsDraft) return;
    const payload: PollUpdatePayload = {
      title: settingsDraft.title.trim() || poll.title,
      description: settingsDraft.description.trim() ? settingsDraft.description : null,
      visibility: settingsDraft.visibility,
      allow_revoting: settingsDraft.allow_revoting,
      anonymous: settingsDraft.anonymous,
      results_visibility: settingsDraft.results_visibility,
      starts_at: settingsDraft.starts_at,
      ends_at: settingsDraft.ends_at,
    };
    updatePollMutation.mutate(
      { pollId, payload },
      {
        onSuccess: () => {
          setSettingsDirty(false);
          toaster.add({ name: 'poll-settings-saved', title: 'Изменения сохранены', theme: 'success' });
        },
        onError: (err) => notifyApiError(err, 'Не удалось сохранить настройки'),
      },
    );
  };

  const handleDeletePoll = () => {
    if (!isDraft) {
      toaster.add({ name: 'poll-delete-locked', title: 'Удалить можно только черновик', theme: 'warning' });
      return;
    }

    openConfirm({
      title: 'Удалить черновик?',
      description: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      mode: 'danger',
      onConfirm: () => {
        deletePollMutation.mutate(pollId, {
          onSuccess: () => {
            setConfirmAction(null);
            toaster.add({ name: 'poll-deleted', title: 'Опрос удалён', theme: 'success' });
            navigate(`${routeBase}/voting`);
          },
          onError: (err) => {
            setConfirmAction(null);
            notifyApiError(err, 'Не удалось удалить опрос');
          },
        });
      },
    });
  };

  const handlePublish = () => {
    if (!isDraft) return;
    if (!canPublish) {
      logger.warn('Voting v2 publish blocked', {
        area: 'voting',
        event: 'voting_v2.publish_blocked',
        data: {
          pollId,
          issues: publishIssues,
        },
      });
      setActiveTab('questions');
      toaster.add({
        name: 'poll-publish-blocked',
        title: 'Опрос не готов к публикации',
        content: publishIssues.join('\n'),
        theme: 'warning',
      });
      return;
    }

    openConfirm({
      title: 'Опубликовать опрос?',
      description: 'После публикации вопросы и варианты будут заблокированы.',
      confirmLabel: 'Опубликовать',
      onConfirm: () => {
        updatePollMutation.mutate(
          { pollId, payload: { status: 'active' } },
          {
            onSuccess: () => {
              logger.info('Voting v2 publish success', {
                area: 'voting',
                event: 'voting_v2.publish_success',
                data: { pollId },
              });
              setConfirmAction(null);
              toaster.add({ name: 'poll-published', title: 'Опрос опубликован', theme: 'success' });
            },
            onError: (err) => {
              setConfirmAction(null);
              const code = isApiError(err) ? err.code : undefined;
              if (code === 'NO_QUESTIONS' || code === 'NO_OPTIONS') {
                setActiveTab('questions');
              }
              notifyApiError(err, 'Не удалось опубликовать опрос');
            },
          },
        );
      },
    });
  };

  const handleClosePoll = () => {
    if (!isActive) return;

    openConfirm({
      title: 'Завершить голосование?',
      description: 'Голосование будет остановлено и новые голоса не будут приниматься.',
      confirmLabel: 'Завершить',
      onConfirm: () => {
        updatePollMutation.mutate(
          { pollId, payload: { status: 'closed' } },
          {
            onSuccess: () => {
              setConfirmAction(null);
              toaster.add({ name: 'poll-closed', title: 'Опрос закрыт', theme: 'success' });
            },
            onError: (err) => {
              setConfirmAction(null);
              notifyApiError(err, 'Не удалось закрыть опрос');
            },
          },
        );
      },
    });
  };

  const openCreateOption = (nominationId: string) => {
    setOptionEditor({ mode: 'create', nominationId, payload: { title: '' } });
  };

  const openEditOption = (nominationId: string, option: Option) => {
    setOptionEditor({
      mode: 'edit',
      nominationId,
      optionId: option.id,
      payload: {
        title: option.title,
        description: option.description ?? undefined,
        media_url: option.media_url ?? undefined,
        game_id: option.game_id ?? undefined,
      },
    });
  };

  const saveOption = () => {
    if (!optionEditor) return;
    if (!isDraft) {
      toaster.add({ name: 'options-locked', title: 'Варианты редактируются только в черновике', theme: 'warning' });
      return;
    }
    if (!optionEditor.payload.title.trim()) return;

    if (optionEditor.mode === 'create') {
      createOptionMutation.mutate(
        { pollId, nominationId: optionEditor.nominationId, payload: optionEditor.payload },
        {
          onSuccess: () => {
            setOptionEditor(null);
            toaster.add({ name: 'option-created', title: 'Вариант добавлен', theme: 'success' });
          },
          onError: (err) => notifyApiError(err, 'Не удалось добавить вариант'),
        },
      );
      return;
    }

    updateOptionMutation.mutate(
      { pollId, optionId: optionEditor.optionId, payload: optionEditor.payload },
      {
        onSuccess: () => {
          setOptionEditor(null);
          toaster.add({ name: 'option-updated', title: 'Вариант обновлён', theme: 'success' });
        },
        onError: (err) => notifyApiError(err, 'Не удалось обновить вариант'),
      },
    );
  };

  const deleteOption = (optionId: string) => {
    if (!isDraft) {
      toaster.add({ name: 'options-locked', title: 'Варианты редактируются только в черновике', theme: 'warning' });
      return;
    }

    openConfirm({
      title: 'Удалить вариант?',
      confirmLabel: 'Удалить',
      mode: 'danger',
      onConfirm: () => {
        deleteOptionMutation.mutate(
          { pollId, optionId },
          {
            onSuccess: () => {
              setConfirmAction(null);
              toaster.add({ name: 'option-deleted', title: 'Вариант удалён', theme: 'success' });
            },
            onError: (err) => {
              setConfirmAction(null);
              notifyApiError(err, 'Не удалось удалить вариант');
            },
          },
        );
      },
    });
  };

  const openCreateNomination = () => {
    if (!isDraft) {
      toaster.add({ name: 'questions-locked', title: 'Вопросы редактируются только в черновике', theme: 'warning' });
      return;
    }
    setCreateQuestionOpen(true);
  };

  const handleCreateNomination = (data: NominationCreatePayload | NominationUpdatePayload) => {
    if (!isDraft) return;
    const payload = data as NominationCreatePayload;
    if (!payload.title?.trim()) return;
    createNominationMutation.mutate(
      { pollId, payload },
      {
        onSuccess: () => {
          setCreateQuestionOpen(false);
          toaster.add({ name: 'question-created', title: 'Вопрос добавлен', theme: 'success' });
        },
        onError: (err) => notifyApiError(err, 'Не удалось добавить вопрос'),
      },
    );
  };

  const openEditNomination = (nomination: NominationWithOptions) => {
    setEditingNomination({
      nominationId: nomination.id,
      title: nomination.title,
      description: nomination.description ?? '',
      kind: nomination.kind,
      max_votes: nomination.max_votes,
      is_required: nomination.is_required,
      sort_order: nomination.sort_order,
    });
  };

  const saveNomination = () => {
    if (!editingNomination) return;
    if (!isDraft) {
      toaster.add({ name: 'questions-locked', title: 'Вопросы редактируются только в черновике', theme: 'warning' });
      return;
    }

    updateNominationMutation.mutate(
      {
        pollId,
        nominationId: editingNomination.nominationId,
        payload: {
          title: editingNomination.title.trim(),
          description: editingNomination.description.trim() ? editingNomination.description : null,
          kind: editingNomination.kind,
          max_votes: editingNomination.max_votes,
          is_required: editingNomination.is_required,
          sort_order: editingNomination.sort_order,
        },
      },
      {
        onSuccess: () => {
          setEditingNomination(null);
          toaster.add({ name: 'question-updated', title: 'Вопрос обновлён', theme: 'success' });
        },
        onError: (err) => notifyApiError(err, 'Не удалось обновить вопрос'),
      },
    );
  };

  const deleteNomination = (nominationId: string) => {
    if (!isDraft) {
      toaster.add({ name: 'questions-locked', title: 'Вопросы редактируются только в черновике', theme: 'warning' });
      return;
    }

    openConfirm({
      title: 'Удалить вопрос?',
      description: 'Все варианты вопроса будут удалены.',
      confirmLabel: 'Удалить',
      mode: 'danger',
      onConfirm: () => {
        deleteNominationMutation.mutate(
          { pollId, nominationId },
          {
            onSuccess: () => {
              setConfirmAction(null);
              toaster.add({ name: 'question-deleted', title: 'Вопрос удалён', theme: 'success' });
            },
            onError: (err) => {
              setConfirmAction(null);
              notifyApiError(err, 'Не удалось удалить вопрос');
            },
          },
        );
      },
    });
  };

  const addParticipant = () => {
    const userId = participantUserId.trim();
    if (!userId) return;

    addParticipantMutation.mutate(
      { pollId, payload: { user_id: userId, role: participantRole } },
      {
        onSuccess: () => {
          setParticipantUserId('');
          toaster.add({ name: 'participant-added', title: 'Участник добавлен', theme: 'success' });
        },
        onError: (err) => notifyApiError(err, 'Не удалось добавить участника'),
      },
    );
  };

  const removeParticipant = (userId: string) => {
    openConfirm({
      title: 'Удалить участника?',
      confirmLabel: 'Удалить',
      mode: 'danger',
      onConfirm: () => {
        removeParticipantMutation.mutate(
          { pollId, userId },
          {
            onSuccess: () => {
              setConfirmAction(null);
              toaster.add({ name: 'participant-removed', title: 'Участник удалён', theme: 'success' });
            },
            onError: (err) => {
              setConfirmAction(null);
              notifyApiError(err, 'Не удалось удалить участника');
            },
          },
        );
      },
    });
  };

  const tabItems = [
    { id: 'settings', label: 'Настройки' },
    { id: 'questions', label: `Вопросы (${sortedNominations.length})` },
    { id: 'participants', label: `Участники (${participants.length})` },
  ] as const;
  const tabIds = {
    settings: 'voting-manage-tab-settings',
    questions: 'voting-manage-tab-questions',
    participants: 'voting-manage-tab-participants',
  } as const;
  const panelIds = {
    settings: 'voting-manage-panel-settings',
    questions: 'voting-manage-panel-questions',
    participants: 'voting-manage-panel-participants',
  } as const;

  return (
    <>
      <VotingPageLayout
        title={poll.title}
        description="Черновик → вопросы → участники → публикация. После публикации вопросы блокируются."
        actions={
          <>
            <Button view="outlined" onClick={() => navigate(`${routeBase}/voting`)}>К списку</Button>
            <Button view="outlined" onClick={() => navigate(`${routeBase}/voting/${pollId}`)}>Просмотр</Button>
            {poll.status === 'closed' ? (
              <Button view="outlined" onClick={() => navigate(`${routeBase}/voting/${pollId}/results`)}>Результаты</Button>
            ) : null}
            <Button
              view="outlined-danger"
              onClick={handleDeletePoll}
              loading={deletePollMutation.isPending}
              disabled={!isDraft}
            >
              Удалить
            </Button>
            {isDraft ? (
              <Button view="action" onClick={handlePublish} disabled={!canPublish} loading={updatePollMutation.isPending}>
                Опубликовать
              </Button>
            ) : null}
            {isActive ? (
              <Button view="action" onClick={handleClosePoll} loading={updatePollMutation.isPending}>
                Закрыть
              </Button>
            ) : null}
          </>
        }
      >
        <Card className="voting-v2__card voting-v2__card--soft">
          <div className="voting-v2__pills">
            <Label theme={statusMeta.theme} size="s" title={statusMeta.description}>{statusMeta.label}</Label>
            <Label theme={visibilityMeta.theme} size="s">{visibilityMeta.label}</Label>
            <Label theme={resultsMeta.theme} size="s">{resultsMeta.label}</Label>
            {poll.allow_revoting ? <Label theme="info" size="s">Переголосование</Label> : null}
            {poll.anonymous ? <Label theme="utility" size="s">Анонимно</Label> : null}
          </div>
        </Card>

        {isDraft && publishIssues.length > 0 ? (
          <Alert
            theme="warning"
            title="Опрос не готов к публикации"
            message={publishIssues.join(' ')}
          />
        ) : null}

        <div className="voting-v2__tabs" role="tablist" aria-label="Управление опросом">
          {tabItems.map((tab) => (
            <Button
              key={tab.id}
              id={tabIds[tab.id]}
              role="tab"
              aria-controls={panelIds[tab.id]}
              aria-selected={activeTab === tab.id}
              view={activeTab === tab.id ? 'action' : 'outlined'}
              size="s"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'settings' && settingsDraft ? (
          <section role="tabpanel" id={panelIds.settings} aria-labelledby={tabIds.settings} className="voting-v2__split">
            <Card className="voting-v2__card">
              <div className="voting-form">
                <div>
                  <label className="voting-form__label">Название</label>
                  <TextInput
                    value={settingsDraft.title}
                    onUpdate={(value) => {
                      setSettingsDraft((prev) => (prev ? { ...prev, title: value } : prev));
                      setSettingsDirty(true);
                    }}
                  />
                </div>

                <div>
                  <label className="voting-form__label">Описание</label>
                  <TextArea
                    id="poll-manage-description"
                    value={settingsDraft.description}
                    onUpdate={(value) => {
                      setSettingsDraft((prev) => (prev ? { ...prev, description: value } : prev));
                      setSettingsDirty(true);
                    }}
                    rows={3}
                  />
                </div>

                <div className="voting-form__grid">
                  <div>
                    <label className="voting-form__label">Видимость</label>
                    <Select
                      value={[settingsDraft.visibility]}
                      onUpdate={(value) => {
                        setSettingsDraft((prev) =>
                          prev ? { ...prev, visibility: (value[0] ?? prev.visibility) as PollVisibility } : prev,
                        );
                        setSettingsDirty(true);
                      }}
                      options={VISIBILITY_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="voting-form__label">Результаты</label>
                    <Select
                      value={[settingsDraft.results_visibility]}
                      onUpdate={(value) => {
                        setSettingsDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                results_visibility: (value[0] ?? prev.results_visibility) as ResultsVisibility,
                              }
                            : prev,
                        );
                        setSettingsDirty(true);
                      }}
                      options={RESULTS_OPTIONS}
                    />
                  </div>
                </div>

                <div className="voting-form__grid">
                  <Checkbox
                    checked={settingsDraft.allow_revoting}
                    onUpdate={(checked) => {
                      setSettingsDraft((prev) => (prev ? { ...prev, allow_revoting: checked } : prev));
                      setSettingsDirty(true);
                    }}
                    content="Разрешить переголосование"
                  />
                  <Checkbox
                    checked={settingsDraft.anonymous}
                    onUpdate={(checked) => {
                      setSettingsDraft((prev) => (prev ? { ...prev, anonymous: checked } : prev));
                      setSettingsDirty(true);
                    }}
                    content="Анонимное голосование"
                  />
                </div>

                <div>
                  <label className="voting-form__label">Расписание</label>
                  <ScheduleForm
                    initialStartsAt={settingsDraft.starts_at}
                    initialEndsAt={settingsDraft.ends_at}
                    onUpdate={(payload) => {
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, starts_at: payload.starts_at, ends_at: payload.ends_at } : prev,
                      );
                      setSettingsDirty(true);
                    }}
                  />
                </div>

                <div className="voting-form__actions">
                  <Button
                    view="outlined"
                    onClick={() => {
                      setSettingsDraft({
                        title: poll.title,
                        description: poll.description ?? '',
                        visibility: poll.visibility,
                        allow_revoting: Boolean(poll.allow_revoting),
                        anonymous: Boolean(poll.anonymous),
                        results_visibility: poll.results_visibility,
                        starts_at: poll.starts_at ?? null,
                        ends_at: poll.ends_at ?? null,
                      });
                      setSettingsDirty(false);
                    }}
                    disabled={!settingsDirty}
                  >
                    Сбросить
                  </Button>
                  <Button view="action" onClick={saveSettings} disabled={!settingsDirty} loading={updatePollMutation.isPending}>
                    Сохранить
                  </Button>
                </div>
              </div>
            </Card>

            <div className="voting-v2__grid">
              <Card className="voting-v2__card voting-v2__card--soft">
                <Text variant="subheader-2" className="voting-v2__section-title">Служебная информация</Text>
                <div className="voting-v2__meta-grid">
                  <div><strong>Область:</strong> {SCOPE_LABELS[poll.scope_type]}</div>
                  <div><strong>Scope ID:</strong> {poll.scope_id}</div>
                  {poll.template ? <div><strong>Шаблон:</strong> {poll.template}</div> : null}
                  <div><strong>Создан:</strong> {formatDateTime(poll.created_at, locale)}</div>
                </div>
              </Card>

              {isDraft && publishIssues.length > 0 ? (
                <Card className="voting-v2__card">
                  <Text variant="subheader-2" className="voting-v2__section-title">Чеклист публикации</Text>
                  <ul className="voting-v2__list voting-v2__small voting-v2__muted">
                    {publishIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <div className="voting-form__actions">
                    <Button view="action" onClick={() => setActiveTab('questions')}>Исправить вопросы</Button>
                  </div>
                </Card>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'questions' ? (
          <section role="tabpanel" id={panelIds.questions} aria-labelledby={tabIds.questions} className="voting-v2__grid">
            <div className="voting-v2__toolbar">
              <div>
                <Text variant="subheader-2" className="voting-v2__section-title">Вопросы</Text>
                <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                  Каждому вопросу нужен хотя бы один вариант ответа.
                </Text>
              </div>
              <Button view="action" onClick={openCreateNomination} disabled={!isDraft}>
                Добавить вопрос
              </Button>
            </div>

            {!isDraft ? (
              <Alert
                theme="normal"
                title="Опрос опубликован"
                message="Вопросы и варианты можно редактировать только в черновике."
              />
            ) : null}

            {sortedNominations.length === 0 ? (
              <Card className="voting-v2__card voting-v2__state-card">
                <Text variant="subheader-2" className="voting-v2__section-title">Вопросов пока нет</Text>
                <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                  Добавьте первый вопрос, чтобы подготовить опрос к публикации.
                </Text>
                <div className="voting-form__actions">
                  <Button view="action" onClick={openCreateNomination} disabled={!isDraft}>Добавить вопрос</Button>
                </div>
              </Card>
            ) : (
              sortedNominations.map((nomination) => {
                const options = [...(nomination.options ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <Card key={nomination.id} className="voting-v2__card">
                    <div className="voting-v2__toolbar">
                      <div>
                        <Text variant="subheader-2" className="voting-v2__section-title">{nomination.title}</Text>
                        {nomination.description ? (
                          <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">{nomination.description}</Text>
                        ) : null}
                        <div className="voting-v2__pills">
                          <Label theme="normal" size="xs">{NOMINATION_KIND_LABELS[nomination.kind]}</Label>
                          <Label theme="utility" size="xs">Макс. выборов: {nomination.max_votes}</Label>
                          {nomination.is_required ? <Label theme="warning" size="xs">Обязательный</Label> : null}
                          <Label theme="info" size="xs">Вариантов: {options.length}</Label>
                        </div>
                      </div>

                      <div className="voting-v2__toolbar-right">
                        <Button view="outlined" size="s" onClick={() => openEditNomination(nomination)} disabled={!isDraft}>
                          Редактировать
                        </Button>
                        <Button view="outlined-danger" size="s" onClick={() => deleteNomination(nomination.id)} disabled={!isDraft}>
                          Удалить
                        </Button>
                      </div>
                    </div>

                    <div className="voting-v2__toolbar" style={{ marginTop: 12 }}>
                      <Text variant="caption-2" className="voting-v2__muted">Варианты ответа</Text>
                      <Button view="outlined" size="s" onClick={() => openCreateOption(nomination.id)} disabled={!isDraft}>
                        Добавить вариант
                      </Button>
                    </div>

                    {options.length === 0 ? (
                      <div className="voting-v2__state-card voting-v2__muted">Варианты пока не добавлены.</div>
                    ) : (
                      <div className="voting-v2__table-like">
                        {options.map((option) => (
                          <div key={option.id} className="voting-v2__row">
                            <div>
                              <div className="voting-v2__option-title">{option.title}</div>
                              {option.description ? (
                                <div className="voting-v2__option-description">{option.description}</div>
                              ) : null}
                              {(option.media_url || option.game_id) ? (
                                <div className="voting-v2__small voting-v2__muted">
                                  {option.media_url ? `Медиа: ${option.media_url}` : null}
                                  {option.media_url && option.game_id ? ' · ' : null}
                                  {option.game_id ? `Game ID: ${option.game_id}` : null}
                                </div>
                              ) : null}
                            </div>
                            <div className="voting-v2__toolbar-right">
                              <Button view="outlined" size="s" onClick={() => openEditOption(nomination.id, option)} disabled={!isDraft}>
                                Редактировать
                              </Button>
                              <Button view="outlined-danger" size="s" onClick={() => deleteOption(option.id)} disabled={!isDraft}>
                                Удалить
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </section>
        ) : null}

        {activeTab === 'participants' ? (
          <section role="tabpanel" id={panelIds.participants} aria-labelledby={tabIds.participants} className="voting-v2__grid">
            <Card className="voting-v2__card">
              <Text variant="subheader-2" className="voting-v2__section-title">Участники и роли</Text>
              <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                Используйте для приватных опросов или выдачи ролей модераторов.
              </Text>

              <div className="voting-form__grid" style={{ marginTop: 12 }}>
                <TextInput placeholder="UUID пользователя" value={participantUserId} onUpdate={setParticipantUserId} />
                <Select
                  value={[participantRole]}
                  onUpdate={(value) => setParticipantRole((value[0] ?? 'participant') as PollRole)}
                  options={PARTICIPANT_OPTIONS}
                />
              </div>
              <div className="voting-form__actions">
                <Button view="action" onClick={addParticipant} loading={addParticipantMutation.isPending}>
                  Добавить
                </Button>
              </div>
            </Card>

            <Card className="voting-v2__card">
              <Text variant="subheader-2" className="voting-v2__section-title">Текущие участники</Text>
              {participants.length === 0 ? (
                <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                  Пока никто не добавлен.
                </Text>
              ) : (
                <div className="voting-v2__table-like">
                  {participants.map((participant) => (
                    <div key={participant.user_id} className="voting-v2__row">
                      <div>
                        <div className="voting-v2__option-title">{participant.user_id}</div>
                        <div className="voting-v2__option-description">
                          Роль: {participant.role} · Статус: {participant.status}
                        </div>
                      </div>
                      <Button view="outlined-danger" size="s" onClick={() => removeParticipant(participant.user_id)}>
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        ) : null}
      </VotingPageLayout>

      <VotingConfirmDialog
        open={Boolean(confirmAction)}
        action={confirmAction}
        onClose={closeConfirm}
        loading={confirmLoading}
      />

      <Modal
        open={createQuestionOpen}
        onClose={() => setCreateQuestionOpen(false)}
        aria-labelledby="create-question-title"
        style={{ '--g-modal-width': '760px' }}
      >
        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          <Text variant="subheader-2" id="create-question-title">Новый вопрос</Text>
          <NominationForm
            onSubmit={handleCreateNomination}
            onCancel={() => setCreateQuestionOpen(false)}
            isSubmitting={createNominationMutation.isPending}
            submitLabel="Добавить вопрос"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(editingNomination)}
        onClose={() => setEditingNomination(null)}
        aria-labelledby="edit-question-title"
        style={{ '--g-modal-width': '720px' }}
      >
        {editingNomination ? (
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <Text variant="subheader-2" id="edit-question-title">Редактировать вопрос</Text>

            <div className="voting-form">
              <div>
                <label className="voting-form__label">Название</label>
                <TextInput
                  value={editingNomination.title}
                  onUpdate={(value) =>
                    setEditingNomination((prev) => (prev ? { ...prev, title: value } : prev))
                  }
                />
              </div>

              <div>
                <label className="voting-form__label">Описание</label>
                <TextArea
                  id="poll-manage-edit-description"
                  value={editingNomination.description}
                  onUpdate={(value) =>
                    setEditingNomination((prev) => (prev ? { ...prev, description: value } : prev))
                  }
                  rows={3}
                />
              </div>

              <div className="voting-form__grid">
                <div>
                  <label className="voting-form__label">Тип</label>
                  <Select
                    value={[editingNomination.kind]}
                    onUpdate={(value) =>
                      setEditingNomination((prev) =>
                        prev ? { ...prev, kind: (value[0] ?? prev.kind) as NominationKind } : prev,
                      )
                    }
                    options={[
                      { value: 'custom', content: 'Свой вариант' },
                      { value: 'game', content: 'Игра' },
                      { value: 'review', content: 'Отзыв' },
                      { value: 'person', content: 'Персона' },
                    ]}
                  />
                </div>

                <div>
                  <label className="voting-form__label">Макс. выборов</label>
                  <TextInput
                    type="number"
                    value={String(editingNomination.max_votes)}
                    controlProps={{ min: 1 }}
                    onUpdate={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      setEditingNomination((prev) =>
                        prev
                          ? { ...prev, max_votes: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 }
                          : prev,
                      );
                    }}
                  />
                </div>
              </div>

              <Checkbox
                checked={editingNomination.is_required}
                onUpdate={(checked) =>
                  setEditingNomination((prev) => (prev ? { ...prev, is_required: checked } : prev))
                }
                content="Обязательный вопрос"
              />
            </div>

            <div className="voting-form__actions">
              <Button view="outlined" onClick={() => setEditingNomination(null)}>Отмена</Button>
              <Button view="action" onClick={saveNomination} loading={updateNominationMutation.isPending}>Сохранить</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(optionEditor)}
        onClose={() => setOptionEditor(null)}
        aria-labelledby="option-modal-title"
        style={{ '--g-modal-width': '720px' }}
      >
        {optionEditor ? (
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <Text variant="subheader-2" id="option-modal-title">
              {optionEditor.mode === 'create' ? 'Новый вариант' : 'Редактировать вариант'}
            </Text>
            <OptionForm
              key={optionEditor.mode === 'create' ? `create-${optionEditor.nominationId}` : `edit-${optionEditor.optionId}`}
              initialData={optionEditor.payload}
              onChange={(payload) => setOptionEditor((prev) => (prev ? { ...prev, payload } : prev))}
            />
            <div className="voting-form__actions">
              <Button view="outlined" onClick={() => setOptionEditor(null)}>Отмена</Button>
              <Button
                view="action"
                onClick={saveOption}
                loading={createOptionMutation.isPending || updateOptionMutation.isPending}
                disabled={!optionEditor.payload.title.trim()}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};
