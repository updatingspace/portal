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
    } catch {
      setCreateError(
        t(
          'Не удалось создать функцию. Проверьте, не занят ли ключ, и повторите.',
          'Unable to create the feature. Check whether the key is already in use and try again.',
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
      actions={
        <>
          <Button size="xl" view="action" onClick={() => setCreateOpen(true)}>
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
        <FormField label={t('Поиск функций', 'Search features')}>
          {(props) => (
            <TextInput {...props} value={search} onUpdate={setSearch} />
          )}
        </FormField>
        {error && (
          <InlineError onRetry={() => void reload()}>
            {t('Не удалось загрузить функции.', 'Unable to load features.')}
          </InlineError>
        )}
        {loading && !flags.length && (
          <PageState
            kind="loading"
            title={t('Загружаем функции', 'Loading features')}
          />
        )}
        {!loading && !error && !visible.length && (
          <PageState
            kind="empty"
            title={
              search
                ? t('Ничего не найдено', 'No matches')
                : t('Функции ещё не созданы', 'No features yet')
            }
            action={
              search && (
                <Button onClick={() => setSearch('')}>
                  {t('Сбросить поиск', 'Clear search')}
                </Button>
              )
            }
          />
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
