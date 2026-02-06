import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Dialog,
  Label,
  Select,
  Text,
  TextArea,
  TextInput,
} from '@gravity-ui/uikit';

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
import type { AchievementImageSet, AchievementStatus } from '../../../types/gamification';
import './gamification.css';

type LocaleEntry = { locale: string; value: string };

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

export const AchievementFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = can(user, 'gamification.achievements.create');
  const canEdit = can(user, 'gamification.achievements.edit');
  const canPublish = can(user, 'gamification.achievements.publish');
  const canEditAchievement = isEdit ? canEdit : canCreate;

  if (!canEditAchievement) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: isEdit ? 'gamification.achievements.edit' : 'gamification.achievements.create',
          tenant: user?.tenant,
          reason: 'Ой... мы и сами в шоке, но у вашего аккаунта нет прав для редактирования ачивок.',
        })}
      />
    );
  }

  const { data: achievement, isLoading } = useAchievement(id);
  const { data: categoriesData } = useCategories();
  const { mutateAsync: createAchievement, isPending: isCreating } = useCreateAchievement();
  const { mutateAsync: updateAchievement, isPending: isUpdating } = useUpdateAchievement();
  const { mutateAsync: createCategory, isPending: isCreatingCategory } = useCreateCategory();

  const [nameEntries, setNameEntries] = useState<LocaleEntry[]>([
    { locale: user?.language ?? 'ru', value: '' },
  ]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<AchievementStatus>('draft');
  const [images, setImages] = useState<AchievementImageSet>({});
  const [error, setError] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const categoryOptions = useMemo(
    () =>
      (categoriesData?.items ?? []).map((item) => ({
        value: item.id,
        content: item.nameI18n.ru ?? item.nameI18n.en ?? item.id,
      })),
    [categoriesData?.items],
  );

  useEffect(() => {
    if (!achievement) return;
    const entries = Object.entries(achievement.nameI18n).map(([locale, value]) => ({
      locale,
      value,
    }));
    setNameEntries(entries.length > 0 ? entries : [{ locale: 'ru', value: '' }]);
    setDescription(achievement.description ?? '');
    setCategory(achievement.category);
    setStatus(achievement.status);
    setImages(achievement.images ?? {});
  }, [achievement]);


  const previewTitle =
    nameEntries.find((entry) => entry.locale === 'ru')?.value ||
    nameEntries[0]?.value ||
    'Achievement';

  const previewImage = images?.medium ?? images?.small ?? images?.large ?? '';

  const handleAddLocale = () => {
    setNameEntries((prev) => [...prev, { locale: '', value: '' }]);
  };

  const handleRemoveLocale = (index: number) => {
    setNameEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
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
      !images?.small &&
      !images?.medium &&
      !images?.large
    ) {
      setError('Для публикации нужно добавить хотя бы одно изображение.');
      return;
    }

    if (isEdit && id) {
      await updateAchievement({
        id,
        payload: {
          nameI18n,
          description,
          category,
          status: statusForSubmit,
          images,
        },
      });
      navigate(`/app/gamification/achievements/${id}`);
      return;
    }

    const created = await createAchievement({
      nameI18n,
      description,
      category,
      status: statusForSubmit,
      images,
    });
    navigate(`/app/gamification/achievements/${created.id}`);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryId.trim() || !newCategoryName.trim()) {
      setError('Заполните slug и название категории.');
      return;
    }
    const created = await createCategory({
      id: newCategoryId.trim(),
      nameI18n: { [user?.language ?? 'ru']: newCategoryName.trim() },
    });
    setCategoryDialogOpen(false);
    setNewCategoryId('');
    setNewCategoryName('');
    setCategory(created.id);
  };

  const submitLabel = isEdit ? 'Сохранить' : 'Создать';

  return (
    <div className="gamification-page" data-qa="achievement-form-page">
      <div className="gamification-header">
        <div className="gamification-header__text">
          <Text variant="header-1">{isEdit ? 'Редактирование ачивки' : 'Новая ачивка'}</Text>
          <Text variant="body-2" color="secondary">
            Заполните описание, категории и медиа.
          </Text>
        </div>
        <div className="gamification-toolbar">
          <Button view="flat" size="m" onClick={() => navigate('/app/gamification')}>
            Назад
          </Button>
        </div>
      </div>

      <Card view="filled">
        {isLoading ? (
          <Text variant="body-2">Загрузка...</Text>
        ) : (
          <div className="gamification-form">
            <div className="gamification-form__main">
              <div className="gamification-field">
                <Text variant="subheader-2">Название (i18n)</Text>
                {nameEntries.map((entry, index) => (
                  <div className="gamification-locale-row" key={`${entry.locale}-${index}`}>
                    <TextInput
                      placeholder="ru"
                      value={entry.locale}
                      onUpdate={(value) =>
                        setNameEntries((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, locale: value } : item)),
                        )
                      }
                    />
                    <TextInput
                      placeholder="Название"
                      value={entry.value}
                      onUpdate={(value) =>
                        setNameEntries((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, value } : item)),
                        )
                      }
                    />
                    <Button view="flat" size="s" onClick={() => handleRemoveLocale(index)}>
                      Удалить
                    </Button>
                  </div>
                ))}
                <Button view="flat" size="s" onClick={handleAddLocale}>
                  Добавить язык
                </Button>
              </div>

              <div className="gamification-field">
                <Text variant="subheader-2">Описание</Text>
                <TextArea rows={5} value={description} onUpdate={setDescription} />
              </div>

              <div className="gamification-field">
                <Text variant="subheader-2">Изображения</Text>
                <div className="gamification-media-grid">
                  <TextInput
                    placeholder="URL small"
                    value={images.small ?? ''}
                    onUpdate={(value) => setImages((prev) => ({ ...prev, small: value }))}
                  />
                  <TextInput
                    placeholder="URL medium"
                    value={images.medium ?? ''}
                    onUpdate={(value) => setImages((prev) => ({ ...prev, medium: value }))}
                  />
                  <TextInput
                    placeholder="URL large"
                    value={images.large ?? ''}
                    onUpdate={(value) => setImages((prev) => ({ ...prev, large: value }))}
                  />
                </div>
              </div>
            </div>

            <div className="gamification-form__aside">
              <div className="gamification-field">
                <Text variant="subheader-2">Категория</Text>
                <Select
                  options={categoryOptions}
                  value={category ? [category] : []}
                  onUpdate={(values) => setCategory((values[0] as string) ?? '')}
                  placeholder="Выберите категорию"
                />
                <Button view="flat" size="s" onClick={() => setCategoryDialogOpen(true)}>
                  Добавить категорию
                </Button>
              </div>

              <div className="gamification-field">
                <Text variant="subheader-2">Статус</Text>
                <Select
                  options={STATUS_OPTIONS}
                  value={[status]}
                  onUpdate={(values) => setStatus((values[0] as AchievementStatus) ?? 'draft')}
                  disabled={!canPublish}
                />
                {!canPublish && (
                  <Text variant="caption-2" color="secondary">
                    Публикация доступна только модераторам.
                  </Text>
                )}
              </div>

              <div className="gamification-field">
                <Text variant="subheader-2">Превью</Text>
                <Card view="outlined">
                  {previewImage ? (
                    <img className="gamification-media-preview" src={previewImage} alt="preview" />
                  ) : (
                    <div className="gamification-media-preview" />
                  )}
                  <Text variant="body-2">{previewTitle}</Text>
                  <Label size="xs">{status}</Label>
                </Card>
              </div>

              {error && (
                <Text variant="caption-2" color="danger">
                  {error}
                </Text>
              )}

              <Button
                view="action"
                size="m"
                loading={isCreating || isUpdating}
                disabled={!canEditAchievement}
                onClick={handleSubmit}
              >
                {submitLabel}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} size="s">
        <Dialog.Header caption="Новая категория" />
        <Dialog.Body>
          <div className="gamification-field">
            <Text variant="body-2">Slug</Text>
            <TextInput value={newCategoryId} onUpdate={setNewCategoryId} placeholder="event" />
          </div>
          <div className="gamification-field">
            <Text variant="body-2">Название</Text>
            <TextInput value={newCategoryName} onUpdate={setNewCategoryName} placeholder="События" />
          </div>
        </Dialog.Body>
      <Dialog.Footer
        textButtonCancel="Отмена"
        textButtonApply={isCreatingCategory ? 'Создаем...' : 'Создать'}
        onClickButtonCancel={() => setCategoryDialogOpen(false)}
        onClickButtonApply={handleCreateCategory}
        loading={isCreatingCategory}
      />
    </Dialog>
  </div>
);
};

export default AchievementFormPage;
