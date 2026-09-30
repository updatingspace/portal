import { useConfirmation } from '../../../shared/ui/portal/useConfirmation';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Select, TextArea, TextInput } from '@gravity-ui/uikit';
import {
  FormField,
  InlineError,
  PageLayout,
  PageState,
} from '../../../shared/ui/portal/PortalUI';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { MediaFallback } from '../../../shared/ui/portal/MediaFallback';

import { useAuth } from '../../../contexts/AuthContext';
import { createClientAccessDeniedError } from '../../../api/accessDenied';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { can } from '../../../features/rbac/can';
import {
  useAchievement,
  useCategories,
  useCreateAchievement,
  useCreateCategory,
  useUpdateAchievement,
} from '../../../hooks/useGamification';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import type {
  Achievement,
  AchievementImageSet,
  AchievementStatus,
} from '../../../types/gamification';
import './gamification.css';

type LocaleEntry = { locale: string; value: string };

type SubmitPayload = {
  nameI18n: Record<string, string>;
  description: string;
  category: string;
  status?: AchievementStatus;
  images: AchievementImageSet;
};

const STATUS_OPTIONS: { value: AchievementStatus; content: string }[] = [
  { value: 'draft', content: 'Черновик' },
  { value: 'published', content: 'Опубликовано' },
  { value: 'hidden', content: 'Скрыто' },
  { value: 'active', content: 'Активно' },
];

const buildI18nMap = (entries: LocaleEntry[]) =>
  entries.reduce<Record<string, string>>((acc, item) => {
    if (item.locale.trim() && item.value.trim()) {
      acc[item.locale.trim()] = item.value.trim();
    }
    return acc;
  }, {});

const buildInitialFormState = (params: {
  achievement?: Achievement;
  language?: string;
}) => {
  const { achievement, language } = params;
  const entries = achievement
    ? Object.entries(achievement.nameI18n).map(([locale, value]) => ({
        locale,
        value,
      }))
    : [{ locale: language ?? 'ru', value: '' }];

  return {
    nameEntries: entries.length > 0 ? entries : [{ locale: 'ru', value: '' }],
    description: achievement?.description ?? '',
    category: achievement?.category ?? '',
    status: achievement?.status ?? 'draft',
    images: achievement?.images ?? {},
  };
};

type FormContentProps = {
  isEdit: boolean;
  canPublish: boolean;
  canEditAchievement: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isCreatingCategory: boolean;
  categoryOptions: { value: string; content: string }[];
  achievement?: Achievement;
  defaultLanguage?: string;
  onBack: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCreateCategory: (params: { id: string; name: string }) => Promise<string>;
};

const AchievementFormContent: React.FC<FormContentProps> = ({
  isEdit,
  canPublish,
  canEditAchievement,
  isCreating,
  isUpdating,
  isCreatingCategory,
  categoryOptions,
  achievement,
  defaultLanguage,
  onBack,
  onSubmit,
  onCreateCategory,
}) => {
  const initial = useMemo(
    () => buildInitialFormState({ achievement, language: defaultLanguage }),
    [achievement, defaultLanguage],
  );

  const { confirm, confirmationDialog } = useConfirmation();
  const savingLock = useRef(false);
  const [nameEntries, setNameEntries] = useState<LocaleEntry[]>(
    initial.nameEntries,
  );
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState<string>(initial.category);
  const [status, setStatus] = useState<AchievementStatus>(initial.status);
  const [images, setImages] = useState<AchievementImageSet>(initial.images);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const previewTitle =
    nameEntries.find((entry) => entry.locale === 'ru')?.value ||
    nameEntries[0]?.value ||
    'Название достижения';
  const previewImage = images?.medium ?? images?.small ?? images?.large ?? '';
  const submitLabel = isEdit ? 'Сохранить' : 'Создать';

  const handleSubmit = async () => {
    if (isCreating || isUpdating || savingLock.current) return;
    setError(null);
    const nameI18n = buildI18nMap(nameEntries);
    if (!Object.keys(nameI18n).length) {
      setError('Заполните хотя бы одно название.');
      return;
    }
    if (!category) {
      setError('Выберите категорию.');
      return;
    }

    const statusForSubmit = canPublish ? status : undefined;
    if (
      (statusForSubmit === 'published' || statusForSubmit === 'active') &&
      !images.small &&
      !images.medium &&
      !images.large
    ) {
      setError('Для публикации нужно добавить хотя бы одно изображение.');
      return;
    }

    savingLock.current = true;
    try {
      await onSubmit({
        nameI18n,
        description,
        category,
        status: statusForSubmit,
        images,
      });
    } catch {
      setError(
        'Не удалось сохранить достижение. Введённые данные сохранены в форме.',
      );
    } finally {
      savingLock.current = false;
    }
  };
  const handleCreateCategory = async () => {
    if (isCreatingCategory) return;
    setCategoryError(null);
    if (!newCategoryId.trim() || !newCategoryName.trim()) {
      setCategoryError('Заполните название и адрес категории.');
      return;
    }
    try {
      const createdId = await onCreateCategory({
        id: newCategoryId.trim(),
        name: newCategoryName.trim(),
      });
      setCategory(createdId);
      setCategoryDialogOpen(false);
      setNewCategoryId('');
      setNewCategoryName('');
    } catch {
      setCategoryError(
        'Не удалось создать категорию. Проверьте адрес и повторите.',
      );
    }
  };

  return (
    <PageLayout
      title={isEdit ? 'Редактирование достижения' : 'Новое достижение'}
    >
      {confirmationDialog}
      <form
        className="gamification-editor portal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <FormField label="Название">
          {(props) => (
            <TextInput
              {...props}
              size="xl"
              value={nameEntries[0]?.value ?? ''}
              onUpdate={(value) =>
                setNameEntries((entries) => [
                  {
                    locale: entries[0]?.locale || defaultLanguage || 'ru',
                    value,
                  },
                  ...entries.slice(1),
                ])
              }
            />
          )}
        </FormField>
        <FormField label="Описание">
          {(props) => (
            <TextArea
              {...props}
              size="xl"
              rows={4}
              value={description}
              onUpdate={setDescription}
            />
          )}
        </FormField>
        <FormField label="Категория">
          {(props) => (
            <div className="gamification-editor__category">
              <Select
                {...props}
                size="xl"
                options={categoryOptions}
                value={category ? [category] : []}
                onUpdate={(values) => setCategory(values[0] ?? '')}
                placeholder="Выберите категорию"
              />
              <Button
                size="xl"
                view="outlined"
                aria-label="Добавить категорию"
                onClick={() => setCategoryDialogOpen(true)}
              >
                Новая
              </Button>
            </div>
          )}
        </FormField>
        <FormField
          label="Изображение"
          hint="Ссылка на изображение. Для публикации оно обязательно."
        >
          {(props) => (
            <TextInput
              {...props}
              size="xl"
              type="url"
              placeholder="https://…"
              value={images.medium ?? ''}
              onUpdate={(value) =>
                setImages((current) => ({ ...current, medium: value }))
              }
            />
          )}
        </FormField>
        {canPublish && (
          <FormField label="Статус">
            {(props) => (
              <Select
                {...props}
                size="xl"
                options={STATUS_OPTIONS}
                value={[status]}
                onUpdate={(values) => setStatus(values[0] as AchievementStatus)}
              />
            )}
          </FormField>
        )}
        <details className="portal-disclosure gamification-editor__advanced">
          <summary>Дополнительно</summary>
          <h2>Переводы названия</h2>
          <div className="portal-stack">
            {nameEntries.map((entry, index) => (
              <div className="gamification-locale-row" key={index}>
                <TextInput
                  size="xl"
                  controlProps={{ 'aria-label': `Язык ${index + 1}` }}
                  value={entry.locale}
                  onUpdate={(locale) =>
                    setNameEntries((entries) =>
                      entries.map((item, i) =>
                        i === index ? { ...item, locale } : item,
                      ),
                    )
                  }
                />
                <TextInput
                  size="xl"
                  controlProps={{
                    'aria-label': `Название на языке ${entry.locale || index + 1}`,
                  }}
                  value={entry.value}
                  onUpdate={(value) =>
                    setNameEntries((entries) =>
                      entries.map((item, i) =>
                        i === index ? { ...item, value } : item,
                      ),
                    )
                  }
                />
                <Button
                  size="xl"
                  view="flat"
                  disabled={index === 0}
                  onClick={() =>
                    setNameEntries((entries) =>
                      entries.filter((_, i) => i !== index),
                    )
                  }
                >
                  Удалить
                </Button>
              </div>
            ))}
            <div>
              <Button
                size="xl"
                onClick={() =>
                  setNameEntries((entries) => [
                    ...entries,
                    { locale: '', value: '' },
                  ])
                }
              >
                Добавить язык
              </Button>
            </div>
          </div>
          <h2>Размеры изображения</h2>
          <div className="portal-stack">
            <FormField label="Маленькое изображение">
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  type="url"
                  value={images.small ?? ''}
                  onUpdate={(value) =>
                    setImages((current) => ({ ...current, small: value }))
                  }
                />
              )}
            </FormField>
            <FormField label="Большое изображение">
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  type="url"
                  value={images.large ?? ''}
                  onUpdate={(value) =>
                    setImages((current) => ({ ...current, large: value }))
                  }
                />
              )}
            </FormField>
          </div>
        </details>
        {error && <InlineError>{error}</InlineError>}
        <div className="portal-actions">
          <Button
            type="submit"
            view="action"
            size="xl"
            loading={isCreating || isUpdating}
            disabled={!canEditAchievement || isCreating || isUpdating}
          >
            {submitLabel}
          </Button>
          <Button size="xl" onClick={() => setPreviewOpen(true)}>
            Предпросмотр
          </Button>
          <Button
            size="xl"
            view="flat"
            disabled={isCreating || isUpdating}
            onClick={() =>
              void (async () => {
                const changed =
                  JSON.stringify({
                    nameEntries,
                    description,
                    category,
                    status,
                    images,
                  }) !== JSON.stringify(initial);
                if (
                  changed &&
                  !(await confirm(
                    'Выйти без сохранения достижения? Введённые изменения будут потеряны.',
                  ))
                )
                  return;
                onBack();
              })()
            }
          >
            Отмена
          </Button>
        </div>
      </form>
      {previewOpen && (
        <ContentDialog
          title="Предпросмотр достижения"
          onClose={() => setPreviewOpen(false)}
        >
          <div className="gamification-award-preview">
            <MediaFallback src={previewImage} alt={previewTitle} />
            <h2>{previewTitle}</h2>
            <p>{description}</p>
          </div>
        </ContentDialog>
      )}
      {categoryDialogOpen && (
        <ContentDialog
          title="Новая категория"
          busy={isCreatingCategory}
          onClose={() => setCategoryDialogOpen(false)}
        >
          <form
            className="portal-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateCategory();
            }}
          >
            <FormField label="Название категории">
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={newCategoryName}
                  onUpdate={setNewCategoryName}
                />
              )}
            </FormField>
            <FormField
              label="Адрес категории"
              hint="Короткий идентификатор латиницей, например events."
            >
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={newCategoryId}
                  onUpdate={setNewCategoryId}
                />
              )}
            </FormField>
            {categoryError && <InlineError>{categoryError}</InlineError>}
            <div>
              <Button
                type="submit"
                view="action"
                size="xl"
                loading={isCreatingCategory}
                disabled={isCreatingCategory}
              >
                Создать
              </Button>
            </div>
          </form>
        </ContentDialog>
      )}
    </PageLayout>
  );
};

export const AchievementFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const { user } = useAuth();
  const canCreate = can(user, 'gamification.achievements.create');
  const canEdit = can(user, 'gamification.achievements.edit');
  const canPublish = can(user, 'gamification.achievements.publish');
  const canEditAchievement = isEdit ? canEdit : canCreate;

  const {
    data: achievement,
    isLoading,
    isError,
    error,
    refetch,
  } = useAchievement(id);
  const achievementTitle =
    achievement?.nameI18n.ru ?? achievement?.nameI18n.en ?? null;
  useDocumentTitle(
    isEdit
      ? achievementTitle
        ? `${achievementTitle} · Редактирование достижения`
        : 'Редактирование достижения'
      : 'Новое достижение',
  );
  const { data: categoriesData } = useCategories();
  const { mutateAsync: createAchievement, isPending: isCreating } =
    useCreateAchievement();
  const { mutateAsync: updateAchievement, isPending: isUpdating } =
    useUpdateAchievement();
  const { mutateAsync: createCategory, isPending: isCreatingCategory } =
    useCreateCategory();

  const categoryOptions = useMemo(
    () =>
      (categoriesData?.items ?? []).map((item) => ({
        value: item.id,
        content: item.nameI18n.ru ?? item.nameI18n.en ?? item.id,
      })),
    [categoriesData?.items],
  );

  const handleSubmit = async (payload: SubmitPayload) => {
    if (isEdit && id) {
      await updateAchievement({ id, payload });
      navigate(`${routeBase}/gamification/achievements/${id}`);
      return;
    }

    const created = await createAchievement(payload);
    navigate(`${routeBase}/gamification/achievements/${created.id}`);
  };

  const handleCreateCategory = async (params: { id: string; name: string }) => {
    const created = await createCategory({
      id: params.id,
      nameI18n: { [user?.language ?? 'ru']: params.name },
    });
    return created.id;
  };

  if (!canEditAchievement) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: isEdit
            ? 'gamification.achievements.edit'
            : 'gamification.achievements.create',
          tenant: user?.tenant,
          reason: 'Нет права управлять достижениями.',
        })}
      />
    );
  }

  if (isEdit && isLoading)
    return <PageState kind="loading" title="Загружаем достижение" />;
  if (isEdit && (isError || !achievement))
    return (
      <PageState
        kind={
          (error as { status?: number } | null)?.status === 404
            ? 'not-found'
            : 'error'
        }
        title="Не удалось открыть достижение"
        action={<Button onClick={() => void refetch()}>Повторить</Button>}
        secondaryAction={
          <Button onClick={() => navigate(`${routeBase}/gamification`)}>
            К достижениям
          </Button>
        }
      />
    );
  return (
    <div className="gamification-page" data-qa="achievement-form-page">
      <AchievementFormContent
        key={achievement?.id ?? (isEdit ? `edit-${id}` : 'new')}
        isEdit={isEdit}
        canPublish={canPublish}
        canEditAchievement={canEditAchievement}
        isCreating={isCreating}
        isUpdating={isUpdating}
        isCreatingCategory={isCreatingCategory}
        categoryOptions={categoryOptions}
        achievement={achievement}
        defaultLanguage={user?.language ?? undefined}
        onBack={() => navigate(`${routeBase}/gamification`)}
        onSubmit={handleSubmit}
        onCreateCategory={handleCreateCategory}
      />
    </div>
  );
};

export default AchievementFormPage;
