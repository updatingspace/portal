import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Label,
  Loader,
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
  usePollInfo,
  useUpdatePoll,
  useDeletePoll,
  useCreateNomination,
  useUpdateNomination,
  useDeleteNomination,
  useCreateOption,
  useUpdateOption,
  useDeleteOption,
  usePollParticipants,
  useAddParticipant,
  useRemoveParticipant,
} from '../../../../features/voting';
import { toaster } from '../../../../toaster';
import { notifyApiError } from '../../../../utils/apiErrorHandling';
import type { NominationCreatePayload, NominationUpdatePayload, PollUpdatePayload } from '../../../../features/voting/types';
import { POLL_STATUS_META, RESULTS_VISIBILITY_META, SCOPE_LABELS, VISIBILITY_META, formatDateTime, NOMINATION_KIND_LABELS } from '../../../../features/voting/utils/pollMeta';
import { getLocale } from '../../../../shared/lib/locale';
import { useAuth } from '../../../../contexts/AuthContext';

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

  useEffect(() => {
    if (!pollInfo) return;
    if (settingsDirty) return;
    const { poll } = pollInfo;
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
  }, [pollInfo?.poll.id, pollInfo?.poll.updated_at, settingsDirty]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (isError || !pollInfo) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить опрос</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {error instanceof Error ? error.message : 'Попробуйте снова.'}
          </Text>
          <Button onClick={() => refetch()} view="action" width="max">
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  const { poll, nominations } = pollInfo;
  const statusMeta = POLL_STATUS_META[poll.status];
  const visibilityMeta = VISIBILITY_META[poll.visibility];
  const resultsMeta = RESULTS_VISIBILITY_META[poll.results_visibility];

  const sortedNominations = useMemo(() => {
    return [...nominations].sort((a, b) => a.sort_order - b.sort_order);
  }, [nominations]);

  const isDraft = poll.status === 'draft';
  const isActive = poll.status === 'active';

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

  const canPublish = isDraft && publishIssues.length === 0;

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
          toaster.add({
            name: 'poll-settings-saved',
            title: 'Изменения сохранены',
            theme: 'success',
          });
        },
        onError: (err) => notifyApiError(err, 'Не удалось сохранить настройки'),
      },
    );
  };

  const handleDeletePoll = () => {
    if (!isDraft) {
      toaster.add({
        name: 'poll-delete-locked',
        title: 'Удалить можно только черновик',
        theme: 'warning',
      });
      return;
    }
    if (!window.confirm('Удалить черновик? Это действие нельзя отменить.')) return;
    deletePollMutation.mutate(pollId, {
      onSuccess: () => {
        toaster.add({
          name: 'poll-deleted',
          title: 'Опрос удалён',
          theme: 'success',
        });
        navigate('/app/voting');
      },
      onError: (err) => notifyApiError(err, 'Не удалось удалить опрос'),
    });
  };

  const handlePublish = () => {
    if (!isDraft) return;
    if (!canPublish) {
      setActiveTab('questions');
      toaster.add({
        name: 'poll-publish-blocked',
        title: 'Опрос не готов к публикации',
        content: publishIssues.join('\n'),
        theme: 'warning',
      });
      return;
    }
    if (!window.confirm('Опубликовать опрос? Вопросы и варианты будут заблокированы.')) return;
    updatePollMutation.mutate(
      { pollId, payload: { status: 'active' } },
      {
        onSuccess: () => {
          toaster.add({
            name: 'poll-published',
            title: 'Опрос опубликован',
            theme: 'success',
          });
        },
        onError: (err) => {
          const code = isApiError(err) ? err.code : undefined;
          if (code === 'NO_QUESTIONS' || code === 'NO_OPTIONS') {
            setActiveTab('questions');
          }
          notifyApiError(err, 'Не удалось опубликовать опрос');
        },
      },
    );
  };

  const handleClosePoll = () => {
    if (!isActive) return;
    if (!window.confirm('Закрыть опрос? Голосование будет остановлено.')) return;
    updatePollMutation.mutate(
      { pollId, payload: { status: 'closed' } },
      {
        onSuccess: () => {
          toaster.add({
            name: 'poll-closed',
            title: 'Опрос закрыт',
            theme: 'success',
          });
        },
        onError: (err) => notifyApiError(err, 'Не удалось закрыть опрос'),
      },
    );
  };

  const openCreateOption = (nominationId: string) => {
    setOptionEditor({
      mode: 'create',
      nominationId,
      payload: { title: '' },
    });
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
      toaster.add({
        name: 'options-locked',
        title: 'Варианты можно редактировать только в черновике',
        theme: 'warning',
      });
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
      toaster.add({
        name: 'options-locked',
        title: 'Варианты можно редактировать только в черновике',
        theme: 'warning',
      });
      return;
    }
    if (!window.confirm('Удалить вариант?')) return;
    deleteOptionMutation.mutate(
      { pollId, optionId },
      {
        onSuccess: () => toaster.add({ name: 'option-deleted', title: 'Вариант удалён', theme: 'success' }),
        onError: (err) => notifyApiError(err, 'Не удалось удалить вариант'),
      },
    );
  };

  const openCreateNomination = () => {
    if (!isDraft) {
      toaster.add({
        name: 'questions-locked',
        title: 'Вопросы можно редактировать только в черновике',
        theme: 'warning',
      });
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
      toaster.add({
        name: 'questions-locked',
        title: 'Вопросы можно редактировать только в черновике',
        theme: 'warning',
      });
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
      toaster.add({
        name: 'questions-locked',
        title: 'Вопросы можно редактировать только в черновике',
        theme: 'warning',
      });
      return;
    }
    if (!window.confirm('Удалить вопрос и все варианты?')) return;
    deleteNominationMutation.mutate(
      { pollId, nominationId },
      {
        onSuccess: () => toaster.add({ name: 'question-deleted', title: 'Вопрос удалён', theme: 'success' }),
        onError: (err) => notifyApiError(err, 'Не удалось удалить вопрос'),
      },
    );
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
    if (!window.confirm('Удалить участника?')) return;
    removeParticipantMutation.mutate(
      { pollId, userId },
      {
        onSuccess: () => toaster.add({ name: 'participant-removed', title: 'Участник удалён', theme: 'success' }),
        onError: (err) => notifyApiError(err, 'Не удалось удалить участника'),
      },
    );
  };

  const tabItems = [
    { id: 'settings', label: 'Настройки' },
    { id: 'questions', label: `Вопросы (${sortedNominations.length})` },
    { id: 'participants', label: `Участники (${participants.length})` },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Text variant="header-1" className="text-slate-900">{poll.title}</Text>
                <Label theme={statusMeta.theme} size="s" title={statusMeta.description}>
                  {statusMeta.label}
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Label theme={visibilityMeta.theme} size="xs">
                  {visibilityMeta.label}
                </Label>
                <Label theme={resultsMeta.theme} size="xs">
                  {resultsMeta.label}
                </Label>
                {poll.allow_revoting && <Label theme="info" size="xs">Переголосование</Label>}
                {poll.anonymous && <Label theme="utility" size="xs">Анонимно</Label>}
              </div>
              <Text variant="body-2" color="secondary">
                Черновик → добавьте вопросы → опубликуйте. После публикации вопросы блокируются.
              </Text>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button view="outlined" onClick={() => navigate('/app/voting')}>
                К списку
              </Button>
              <Button view="outlined" href={`/app/voting/${pollId}`}>
                Просмотр
              </Button>
              {poll.status === 'closed' && (
                <Button view="outlined" href={`/app/voting/${pollId}/results`}>
                  Результаты
                </Button>
              )}
              <Button
                view="outlined-danger"
                onClick={handleDeletePoll}
                loading={deletePollMutation.isPending}
                disabled={!isDraft}
              >
                Удалить
              </Button>
              {isDraft && (
                <Button view="action" onClick={handlePublish} disabled={!canPublish} loading={updatePollMutation.isPending}>
                  Опубликовать
                </Button>
              )}
              {isActive && (
                <Button view="action" onClick={handleClosePoll} loading={updatePollMutation.isPending}>
                  Закрыть
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {isDraft && publishIssues.length > 0 && (
          <Alert
            theme="warning"
            title="Опрос не готов к публикации"
            message={publishIssues.join(' ')}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {tabItems.map((tab) => (
            <Button
              key={tab.id}
              view={activeTab === tab.id ? 'action' : 'outlined'}
              size="s"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'settings' && settingsDraft && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
            <Card className="p-6 space-y-5">
              <div>
                <Text variant="subheader-2">Настройки опроса</Text>
                <Text variant="body-2" color="secondary" className="mt-1">
                  Задайте общие параметры, видимость и расписание.
                </Text>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Название</div>
                <TextInput
                  value={settingsDraft.title}
                  onUpdate={(value) => {
                    setSettingsDraft((prev) => (prev ? { ...prev, title: value } : prev));
                    setSettingsDirty(true);
                  }}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Описание</div>
                <TextArea
                  value={settingsDraft.description}
                  onUpdate={(value) => {
                    setSettingsDraft((prev) => (prev ? { ...prev, description: value } : prev));
                    setSettingsDirty(true);
                  }}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">Видимость</div>
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

                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">Результаты</div>
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

              <div className="grid gap-3 md:grid-cols-2">
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
                <Text variant="subheader-2" className="mb-2">Расписание</Text>
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

              <div className="flex justify-end gap-2">
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
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <Text variant="subheader-2">Служебная информация</Text>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">Область:</span> {SCOPE_LABELS[poll.scope_type]}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Scope ID:</span> {poll.scope_id}
                  </div>
                  {poll.template && (
                    <div>
                      <span className="font-semibold text-slate-800">Шаблон:</span> {poll.template}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-800">Создан:</span> {formatDateTime(poll.created_at, locale)}
                  </div>
                </div>
              </Card>

              {isDraft && publishIssues.length > 0 && (
                <Card className="p-5 border border-amber-200 bg-amber-50">
                  <Text variant="subheader-2" className="text-amber-800">Чеклист публикации</Text>
                  <ul className="mt-3 list-disc list-inside text-sm text-amber-700 space-y-1">
                    {publishIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <Button view="action" className="mt-4" onClick={() => setActiveTab('questions')}>
                    Исправить вопросы
                  </Button>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Text variant="subheader-2">Вопросы</Text>
                <Text variant="body-2" color="secondary">Каждому вопросу нужен хотя бы один вариант ответа.</Text>
              </div>
              <Button view="action" onClick={openCreateNomination} disabled={!isDraft}>
                Добавить вопрос
              </Button>
            </div>

            {!isDraft && (
              <Alert
                theme="normal"
                title="Опрос опубликован"
                message="Вопросы и варианты можно редактировать только в черновике."
              />
            )}

            {sortedNominations.length === 0 ? (
              <Card className="p-8 text-center">
                <Text variant="subheader-2" className="mb-2">Вопросов пока нет</Text>
                <Text variant="body-2" color="secondary" className="mb-4">
                  Добавьте первый вопрос, чтобы подготовить опрос к публикации.
                </Text>
                <Button view="action" onClick={openCreateNomination} disabled={!isDraft}>
                  Добавить вопрос
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {sortedNominations.map((nomination) => {
                  const options = [...(nomination.options ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <Card key={nomination.id} className="p-6 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <Text variant="subheader-2">{nomination.title}</Text>
                          {nomination.description && (
                            <Text variant="body-2" color="secondary">{nomination.description}</Text>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <Label theme="normal" size="xs">{NOMINATION_KIND_LABELS[nomination.kind]}</Label>
                            <Label theme="utility" size="xs">Макс. выборов: {nomination.max_votes}</Label>
                            {nomination.is_required && <Label theme="warning" size="xs">Обязательный</Label>}
                            <Label theme="info" size="xs">Вариантов: {options.length}</Label>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button view="outlined" size="s" onClick={() => openEditNomination(nomination)} disabled={!isDraft}>
                            Редактировать
                          </Button>
                          <Button view="outlined-danger" size="s" onClick={() => deleteNomination(nomination.id)} disabled={!isDraft}>
                            Удалить
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Text variant="caption-2">Варианты ответа</Text>
                          <Button view="outlined" size="s" onClick={() => openCreateOption(nomination.id)} disabled={!isDraft}>
                            Добавить вариант
                          </Button>
                        </div>

                        {options.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                            Варианты пока не добавлены.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {options.map((option) => (
                              <div
                                key={option.id}
                                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="space-y-1">
                                  <div className="font-medium text-slate-900">{option.title}</div>
                                  {option.description && (
                                    <div className="text-sm text-slate-600">{option.description}</div>
                                  )}
                                  {(option.media_url || option.game_id) && (
                                    <div className="text-xs text-slate-500">
                                      {option.media_url ? `Медиа: ${option.media_url}` : null}
                                      {option.media_url && option.game_id ? ' · ' : null}
                                      {option.game_id ? `Game ID: ${option.game_id}` : null}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    view="outlined"
                                    size="s"
                                    onClick={() => openEditOption(nomination.id, option)}
                                    disabled={!isDraft}
                                  >
                                    Редактировать
                                  </Button>
                                  <Button
                                    view="outlined-danger"
                                    size="s"
                                    onClick={() => deleteOption(option.id)}
                                    disabled={!isDraft}
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-6">
            <Card className="p-6">
              <Text variant="subheader-2">Участники и роли</Text>
              <Text variant="body-2" color="secondary" className="mt-1">
                Используйте для приватных опросов или выдачи ролей модераторов.
              </Text>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr,200px,auto]">
                <TextInput
                  placeholder="UUID пользователя"
                  value={participantUserId}
                  onUpdate={setParticipantUserId}
                />
                <Select
                  value={[participantRole]}
                  onUpdate={(value) => setParticipantRole((value[0] ?? 'participant') as PollRole)}
                  options={PARTICIPANT_OPTIONS}
                />
                <Button view="action" onClick={addParticipant} loading={addParticipantMutation.isPending}>
                  Добавить
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <Text variant="subheader-2" className="mb-4">Текущие участники</Text>
              {participants.length === 0 ? (
                <Text variant="body-2" color="secondary">Пока никто не добавлен.</Text>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.user_id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{participant.user_id}</div>
                        <div className="text-sm text-slate-600">
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
          </div>
        )}
      </div>

      <Modal
        open={createQuestionOpen}
        onClose={() => setCreateQuestionOpen(false)}
        aria-labelledby="create-question-title"
        style={{ '--g-modal-width': '760px' }}
      >
        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          <Text variant="subheader-2" id="create-question-title">
            Новый вопрос
          </Text>
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
        {editingNomination && (
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <Text variant="subheader-2" id="edit-question-title">
              Редактировать вопрос
            </Text>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Название</div>
                <TextInput
                  value={editingNomination.title}
                  onUpdate={(value) =>
                    setEditingNomination((prev) => (prev ? { ...prev, title: value } : prev))
                  }
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Описание</div>
                <TextArea
                  value={editingNomination.description}
                  onUpdate={(value) =>
                    setEditingNomination((prev) => (prev ? { ...prev, description: value } : prev))
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">Тип</div>
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

                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">Макс. выборов</div>
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

            <div className="flex justify-end gap-2">
              <Button view="outlined" onClick={() => setEditingNomination(null)}>
                Отмена
              </Button>
              <Button view="action" onClick={saveNomination} loading={updateNominationMutation.isPending}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(optionEditor)}
        onClose={() => setOptionEditor(null)}
        aria-labelledby="option-modal-title"
        style={{ '--g-modal-width': '720px' }}
      >
        {optionEditor && (
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <Text variant="subheader-2" id="option-modal-title">
              {optionEditor.mode === 'create' ? 'Новый вариант' : 'Редактировать вариант'}
            </Text>
            <OptionForm
              key={optionEditor.mode === 'create' ? `create-${optionEditor.nominationId}` : `edit-${optionEditor.optionId}`}
              initialData={optionEditor.payload}
              onChange={(payload) => setOptionEditor((prev) => (prev ? { ...prev, payload } : prev))}
            />
            <div className="flex justify-end gap-2">
              <Button view="outlined" onClick={() => setOptionEditor(null)}>
                Отмена
              </Button>
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
        )}
      </Modal>
    </div>
  );
};
