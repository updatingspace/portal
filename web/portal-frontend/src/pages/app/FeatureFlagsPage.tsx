import { ApiError } from '../../api/client';
import { ListSkeleton } from '../../shared/ui/portal/ListSkeleton';
import { ContentDialog } from '../../shared/ui/portal/ContentDialog';
import { useRef, useState } from 'react';
import { Button, Switch, TextInput } from '@gravity-ui/uikit';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../modules/featureFlags/hooks';
import {
  FormField,
  InlineError,
  PageLayout,
  PageState,
  useUITranslation,
} from '../../shared/ui/portal/PortalUI';

export function FeatureFlagsPage() {
  const { user } = useAuth();
  const { flags, loading, error, reload, create, patch } = useFeatureFlags();
  const t = useUITranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const locks = useRef(new Set<string>());
  const visible = flags.filter((flag) =>
    `${flag.key} ${flag.description ?? ''}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const onCreate = async () => {
    if (locks.current.has('create')) return;
    const normalized = key.trim();
    if (!/^[a-z][a-z0-9_.-]*$/.test(normalized)) {
      setCreateError(
        t(
          'Используйте латинские буквы, цифры, точку, дефис или подчёркивание. Начните с буквы.',
          'Use letters, numbers, dots, dashes or underscores. Start with a letter.',
        ),
      );
      return;
    }
    locks.current.add('create');
    setCreating(true);
    setCreateError(null);
    try {
      await create({
        key: normalized,
        description: description.trim(),
        enabled: false,
        rollout: 100,
      });
      setCreateOpen(false);
      setKey('');
      setDescription('');
    } catch (reason) {
      setCreateError(
        reason instanceof ApiError && reason.status === 409
          ? t(
              'Такой ключ уже существует. Обновите список.',
              'This key already exists. Refresh the list.',
            )
          : t(
              'Не удалось создать функцию. Введённые данные сохранены. Повторите попытку.',
              'Unable to create the feature. Your entries are still here. Try again.',
            ),
      );
    } finally {
      locks.current.delete('create');
      setCreating(false);
    }
  };
  const onToggle = async (flagKey: string, enabled: boolean) => {
    if (locks.current.has(flagKey)) return;
    locks.current.add(flagKey);
    setPending((current) => [...current, flagKey]);
    setActionErrors((current) => ({ ...current, [flagKey]: '' }));
    try {
      await patch(flagKey, { enabled });
    } catch {
      setActionErrors((current) => ({
        ...current,
        [flagKey]: t(
          'Изменение не сохранено. Повторите попытку.',
          'Change not saved. Try again.',
        ),
      }));
    } finally {
      locks.current.delete(flagKey);
      setPending((current) => current.filter((key) => key !== flagKey));
    }
  };
  if (!user?.isSuperuser)
    return (
      <PageState
        kind="forbidden"
        title={t('Недостаточно прав', 'Access restricted')}
      />
    );
  return (
    <PageLayout
      title={t('Функции платформы', 'Platform features')}
      description={t(
        'Управляйте доступностью уже подключённых функций. Новый ключ должен поддерживаться приложением.',
        'Control features supported by the application. New keys need to be connected in the application.',
      )}
      actions={
        <>
          <Button
            size="xl"
            view="action"
            disabled={loading}
            onClick={() => setCreateOpen(true)}
          >
            {t('Новая функция', 'New feature')}
          </Button>
          <Button
            disabled={loading || creating || pending.length > 0}
            onClick={() => void reload()}
          >
            {t('Обновить', 'Refresh')}
          </Button>
        </>
      }
    >
      <div className="portal-stack">
        {flags.length > 0 && (
          <FormField label={t('Поиск функций', 'Search features')}>
            {(props) => (
              <TextInput
                {...props}
                size="xl"
                value={search}
                onUpdate={setSearch}
                hasClear
                placeholder={t('По названию или ключу', 'Name or key')}
              />
            )}
          </FormField>
        )}
        {error && (
          <InlineError onRetry={() => void reload()}>
            {t('Не удалось загрузить функции.', 'Unable to load features.')}
          </InlineError>
        )}
        {loading && !flags.length && (
          <ListSkeleton label={t('Загружаем функции', 'Loading features')} />
        )}
        {!loading && !error && !visible.length && (
          <section className="portal-list-empty" role="status">
            <h2>
              {search
                ? t('Ничего не найдено', 'No matches')
                : t('Функции ещё не созданы', 'No features yet')}
            </h2>
            <p>
              {search
                ? t(
                    'Попробуйте другое название или ключ.',
                    'Try a different name or key.',
                  )
                : t(
                    'Добавьте первый флаг. Он будет выключен до вашего решения.',
                    'Add your first flag. It stays disabled until you enable it.',
                  )}
            </p>
            {search && (
              <Button onClick={() => setSearch('')}>
                {t('Сбросить поиск', 'Clear search')}
              </Button>
            )}
          </section>
        )}

        {visible.map((flag) => (
          <article className="portal-feature-row" key={flag.key}>
            <div className="portal-feature-row__header">
              <div>
                <h2>{flag.description || flag.key}</h2>
                <p>{flag.key}</p>
              </div>
              <Switch
                controlProps={{ 'aria-label': flag.description || flag.key }}
                checked={flag.enabled}
                disabled={pending.includes(flag.key)}
                onUpdate={(value) => void onToggle(flag.key, value)}
                content={
                  pending.includes(flag.key)
                    ? t('Сохраняем…', 'Saving…')
                    : flag.enabled
                      ? t('Включена', 'Enabled')
                      : t('Выключена', 'Disabled')
                }
              />
            </div>
            {actionErrors[flag.key] && (
              <InlineError>{actionErrors[flag.key]}</InlineError>
            )}
          </article>
        ))}
      </div>
      {createOpen && (
        <ContentDialog
          title={t('Новая функция', 'New feature')}
          busy={creating}
          onClose={() => setCreateOpen(false)}
        >
          {' '}
          <form
            className="portal-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <FormField
              label={t('Ключ', 'Key')}
              hint={t(
                'Технический идентификатор, например community_calendar.',
                'Technical identifier, for example community_calendar.',
              )}
            >
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={key}
                  onUpdate={setKey}
                  disabled={creating}
                />
              )}
            </FormField>
            <FormField label={t('Описание', 'Description')}>
              {(props) => (
                <TextInput
                  {...props}
                  size="xl"
                  value={description}
                  onUpdate={setDescription}
                  disabled={creating}
                />
              )}
            </FormField>
            {createError && <InlineError>{createError}</InlineError>}
            <div>
              <Button
                type="submit"
                view="action"
                loading={creating}
                disabled={creating}
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
