import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Label, Select, TextArea, TextInput } from '@gravity-ui/uikit';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useSessionDraft } from '../../../shared/hooks/useSessionDraft';
import {
  FormField,
  InlineError,
  PageLayout,
  PageState,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { MediaFallback } from '../../../shared/ui/portal/MediaFallback';
import { ListSkeleton } from '../../../shared/ui/portal/ListSkeleton';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import {
  useAchievement,
  useCategories,
  useCreateAchievement,
  useCreateCategory,
  useUpdateAchievement,
} from '../../../hooks/useGamification';
import { uploadAchievementImage } from '../../../api/gamification';
import type {
  Achievement,
  AchievementImageSet,
  AchievementStatus,
} from '../../../types/gamification';
import './gamification.css';

type Draft = {
  nameI18n: Record<string, string>;
  description: string;
  category: string;
  images: AchievementImageSet;
};
function AchievementEditor({ achievement }: { achievement?: Achievement }) {
  const t = useUITranslation();
  const { locale } = useFormatters();
  const { user } = useAuth();
  const base = useRouteBase();
  const navigate = useNavigate();
  const isEdit = Boolean(achievement);
  const categoryQuery = useCategories();
  const create = useCreateAchievement();
  const update = useUpdateAchievement();
  const createCategory = useCreateCategory();
  const canPublish = can(user, 'gamification.achievements.publish');
  const canHide = can(user, 'gamification.achievements.hide');
  const canManageCategories = can(user, 'gamification.categories.manage');
  const draft = useSessionDraft<Draft>(
    `${user?.id}:${user?.tenant?.id}:achievement:${achievement?.id ?? 'new'}`,
    {
      nameI18n: achievement?.nameI18n ?? { [locale]: '' },
      description: achievement?.description ?? '',
      category: achievement?.category ?? '',
      images: achievement?.images ?? {},
    },
  );
  const { value, setValue } = draft;
  const nameLocale =
    value.nameI18n[locale] !== undefined
      ? locale
      : (Object.keys(value.nameI18n)[0] ?? locale);
  const title = value.nameI18n[nameLocale] ?? '';
  const image =
    value.images.medium || value.images.large || value.images.small || '';
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const pending = create.isPending || update.isPending || uploading;
  const categories = categoryQuery.data?.items ?? [];
  useEffect(() => {
    if (
      !value.category &&
      categoryQuery.data?.items.some((item) => item.id === 'fun')
    )
      setValue((current) => ({ ...current, category: 'fun' }));
  }, [categoryQuery.data, value.category, setValue]);
  const submit = async (status?: AchievementStatus) => {
    if (lock.current || pending) return;
    if (!title.trim()) {
      setError(t('Введите название.', 'Enter a name.'));
      return;
    }
    if (!value.category) {
      setError(t('Выберите категорию.', 'Choose a category.'));
      return;
    }
    if (
      (status === 'published' || achievement?.status === 'published') &&
      !image
    ) {
      setError(
        t(
          'Добавьте изображение перед публикацией.',
          'Add an image before publishing.',
        ),
      );
      return;
    }
    lock.current = true;
    setError('');
    try {
      const payload = { ...value, status };
      const saved = achievement
        ? await update.mutateAsync({ id: achievement.id, payload })
        : await create.mutateAsync(payload);
      draft.clear();
      navigate(`${base}/gamification/achievements/${saved.id}`);
    } catch {
      setError(
        t(
          'Не удалось сохранить достижение. Изменения сохранены в черновике.',
          'Unable to save the achievement. Your draft is still here.',
        ),
      );
    } finally {
      lock.current = false;
    }
  };
  const upload = async (file?: File) => {
    if (!file || pending) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setUploadError(
        t(
          'Выберите PNG, JPEG или WebP до 2 МБ.',
          'Choose a PNG, JPEG or WebP up to 2 MB.',
        ),
      );
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadAchievementImage(file);
      setValue((current) => ({ ...current, images: { medium: result.url } }));
    } catch {
      setUploadError(
        t(
          'Изображение не загрузилось. Попробуйте ещё раз.',
          'Image upload failed. Try again.',
        ),
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const addCategory = async () => {
    if (createCategory.isPending) return;
    if (!categoryName.trim() || !categorySlug.trim()) {
      setCategoryError(
        t(
          'Заполните название и адрес категории.',
          'Enter the category name and key.',
        ),
      );
      return;
    }
    setCategoryError('');
    try {
      const created = await createCategory.mutateAsync({
        id: categorySlug.trim(),
        nameI18n: { [locale]: categoryName.trim() },
      });
      setValue((current) => ({ ...current, category: created.id }));
      setCategoryOpen(false);
    } catch {
      setCategoryError(
        t(
          'Не удалось создать категорию. Проверьте адрес и повторите.',
          'Unable to create the category. Check the key and try again.',
        ),
      );
    }
  };
  const statusLabel =
    achievement?.status === 'published' || achievement?.status === 'active'
      ? t('Опубликовано', 'Published')
      : achievement?.status === 'hidden'
        ? t('Скрыто', 'Hidden')
        : t('Черновик', 'Draft');
  return (
    <PageLayout
      title={
        isEdit
          ? t('Редактирование достижения', 'Edit achievement')
          : t('Новое достижение', 'New achievement')
      }
    >
      {draft.guard}
      <form
        className="achievement-workspace"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <aside className="achievement-workspace__preview">
          <MediaFallback
            src={image}
            alt={title || t('Изображение достижения', 'Achievement image')}
          />
          <h2>{title || t('Название достижения', 'Achievement name')}</h2>
          <Label>{statusLabel}</Label>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label={t('Загрузить изображение', 'Upload image')}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button
            size="l"
            view="outlined"
            loading={uploading}
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            {image
              ? t('Заменить изображение', 'Replace image')
              : t('Загрузить изображение', 'Upload image')}
          </Button>
          <small>PNG, JPEG, WebP · {t('до 2 МБ', 'up to 2 MB')}</small>
          {uploadError && <InlineError>{uploadError}</InlineError>}
        </aside>
        <div className="achievement-workspace__fields portal-stack">
          <FormField label={t('Название', 'Name')}>
            {(props) => (
              <TextInput
                {...props}
                size="xl"
                value={title}
                disabled={pending}
                onUpdate={(name) =>
                  setValue((current) => ({
                    ...current,
                    nameI18n: { ...current.nameI18n, [nameLocale]: name },
                  }))
                }
              />
            )}
          </FormField>
          <FormField label={t('Описание', 'Description')}>
            {(props) => (
              <TextArea
                {...props}
                size="xl"
                rows={3}
                value={value.description}
                disabled={pending}
                onUpdate={(description) =>
                  setValue((current) => ({ ...current, description }))
                }
              />
            )}
          </FormField>
          <FormField label={t('Категория', 'Category')}>
            {(props) => (
              <div className="gamification-editor__category">
                <Select
                  {...props}
                  size="xl"
                  value={value.category ? [value.category] : []}
                  options={categories.map((item) => ({
                    value: item.id,
                    content:
                      item.nameI18n[locale] ?? item.nameI18n.en ?? item.id,
                  }))}
                  onUpdate={(values) =>
                    setValue((current) => ({
                      ...current,
                      category: values[0] ?? '',
                    }))
                  }
                  disabled={pending || categoryQuery.isLoading}
                  placeholder={t('Выберите категорию', 'Choose a category')}
                />
                {canManageCategories && (
                  <Button
                    size="xl"
                    view="flat"
                    aria-label={t('Добавить категорию', 'Add category')}
                    onClick={() => setCategoryOpen(true)}
                  >
                    {t('Новая', 'New')}
                  </Button>
                )}
              </div>
            )}
          </FormField>
          {categoryQuery.isError && (
            <InlineError onRetry={() => void categoryQuery.refetch()}>
              {t(
                'Не удалось загрузить категории.',
                'Unable to load categories.',
              )}
            </InlineError>
          )}
          <details className="portal-disclosure">
            <summary>
              {t(
                'Переводы и ссылка на изображение',
                'Translations and image link',
              )}
            </summary>
            <div className="portal-stack">
              {(['en', 'ru'] as const)
                .filter((language) => language !== nameLocale)
                .map((language) => (
                  <FormField
                    key={language}
                    label={language === 'en' ? 'English' : 'Русский'}
                  >
                    {(props) => (
                      <TextInput
                        {...props}
                        size="l"
                        value={value.nameI18n[language] ?? ''}
                        disabled={pending}
                        onUpdate={(name) =>
                          setValue((current) => ({
                            ...current,
                            nameI18n: { ...current.nameI18n, [language]: name },
                          }))
                        }
                      />
                    )}
                  </FormField>
                ))}
              <FormField label={t('Ссылка на изображение', 'Image link')}>
                {(props) => (
                  <TextInput
                    {...props}
                    size="l"
                    value={image}
                    disabled={pending}
                    onUpdate={(url) =>
                      setValue((current) => ({
                        ...current,
                        images: { medium: url },
                      }))
                    }
                  />
                )}
              </FormField>
            </div>
          </details>
          {error && <InlineError>{error}</InlineError>}
          <div className="portal-actions">
            <Button
              size="l"
              type="submit"
              view="action"
              loading={pending}
              disabled={pending}
            >
              {isEdit
                ? t('Сохранить', 'Save')
                : t('Сохранить черновик', 'Save draft')}
            </Button>
            {canPublish &&
              achievement?.status !== 'published' &&
              achievement?.status !== 'active' && (
                <Button
                  size="l"
                  disabled={pending}
                  onClick={() => void submit('published')}
                >
                  {t('Опубликовать', 'Publish')}
                </Button>
              )}
            {canHide &&
              (achievement?.status === 'published' ||
                achievement?.status === 'active') && (
                <Button
                  size="l"
                  disabled={pending}
                  onClick={() => void submit('hidden')}
                >
                  {t('Скрыть', 'Hide')}
                </Button>
              )}
            <Button size="l" view="flat" onClick={() => setPreview(true)}>
              {t('Предпросмотр', 'Preview')}
            </Button>
            <Button
              size="l"
              view="flat"
              disabled={pending}
              onClick={() => navigate(`${base}/gamification`)}
            >
              {t('Отмена', 'Cancel')}
            </Button>
          </div>
        </div>
      </form>
      {preview && (
        <ContentDialog
          title={t('Предпросмотр достижения', 'Achievement preview')}
          onClose={() => setPreview(false)}
        >
          <div className="gamification-award-preview">
            <MediaFallback src={image} alt={title} />
            <h2>{title}</h2>
            <p>{value.description}</p>
          </div>
        </ContentDialog>
      )}
      {categoryOpen && canManageCategories && (
        <ContentDialog
          title={t('Новая категория', 'New category')}
          busy={createCategory.isPending}
          onClose={() => setCategoryOpen(false)}
        >
          <form
            className="portal-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void addCategory();
            }}
          >
            <FormField label={t('Название категории', 'Category name')}>
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={categoryName}
                  onUpdate={setCategoryName}
                />
              )}
            </FormField>
            <FormField
              label={t('Адрес категории', 'Category key')}
              hint={t(
                'Латинские буквы, например events.',
                'Latin letters, for example events.',
              )}
            >
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={categorySlug}
                  onUpdate={setCategorySlug}
                />
              )}
            </FormField>
            {categoryError && <InlineError>{categoryError}</InlineError>}
            <div>
              <Button
                type="submit"
                view="action"
                size="l"
                loading={createCategory.isPending}
              >
                {t('Создать', 'Create')}
              </Button>
            </div>
          </form>
        </ContentDialog>
      )}
    </PageLayout>
  );
}

export function AchievementFormPage() {
  const { id } = useParams<{ id: string }>();
  const t = useUITranslation();
  const { user } = useAuth();
  const query = useAchievement(id);
  const base = useRouteBase();
  const navigate = useNavigate();
  if (
    !can(
      user,
      id
        ? 'gamification.achievements.edit'
        : 'gamification.achievements.create',
    )
  )
    return (
      <PageState
        kind="forbidden"
        title={t('Недостаточно прав', 'Access restricted')}
      />
    );
  if (id && query.isLoading)
    return (
      <PageLayout title={t('Редактирование достижения', 'Edit achievement')}>
        <ListSkeleton
          label={t('Загружаем достижение', 'Loading achievement')}
        />
      </PageLayout>
    );
  if (id && (query.isError || !query.data))
    return (
      <PageLayout title={t('Достижение недоступно', 'Achievement unavailable')}>
        <InlineError onRetry={() => void query.refetch()}>
          {t('Не удалось открыть достижение', 'Unable to open achievement')}
        </InlineError>
        <Button onClick={() => navigate(`${base}/gamification`)}>
          {t('К достижениям', 'Back to achievements')}
        </Button>
      </PageLayout>
    );
  return <AchievementEditor key={id ?? 'new'} achievement={query.data} />;
}
export default AchievementFormPage;
