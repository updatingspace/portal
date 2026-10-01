import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Icon, Skeleton, TextArea, TextInput } from '@gravity-ui/uikit';
import {
  ArrowRight,
  ArrowRotateRight,
  Magnifier,
  Plus,
  Xmark,
} from '@gravity-ui/icons';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  fetchEntryMe,
  submitTenantApplication,
  type EntryMeResponse,
} from '../../api/tenant';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { AuthActions } from '../../widgets/app-shell/AuthActions';
import {
  FormField,
  InlineError,
  useUITranslation,
} from '../../shared/ui/portal/PortalUI';
import { ContentDialog } from '../../shared/ui/portal/ContentDialog';
import { useSessionDraft } from '../../shared/hooks/useSessionDraft';
import { TenantApplicationReviewPanel } from './TenantApplicationReviewPanel';
import { CommunityMark } from './CommunityMark';
import './TenantChooserPage.css';

type Application = { name: string; slug: string; description: string };
const emptyApplication: Application = { name: '', slug: '', description: '' };

export function TenantChooserPage() {
  const { user } = useAuth();
  const { doSwitchTenant, setAvailableTenants } = useTenantContext();
  const navigate = useNavigate();
  const t = useUITranslation();
  const [data, setData] = useState<EntryMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [applicationStep, setApplicationStep] = useState(0);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const {
    value: savedDraft,
    setValue: saveDraft,
    clear: clearDraft,
    guard,
  } = useSessionDraft<Application>(
    `${user?.id}:account:new-community`,
    emptyApplication,
  );
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('Введите название', 'Enter a name'))
          .max(128, t('Не более 128 символов', 'Use up to 128 characters')),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/,
            t(
              'Латинские буквы, цифры и дефис; не более 32 символов',
              'Use letters, numbers and hyphens, up to 32 characters',
            ),
          )
          .refine(
            (s) =>
              ![
                'www',
                'portal',
                'api',
                'id',
                'admin',
                'app',
                'support',
                'docs',
              ].includes(s),
            t('Этот адрес зарезервирован', 'This address is reserved'),
          ),
        description: z
          .string()
          .trim()
          .max(4000, t('Не более 4000 символов', 'Use up to 4000 characters')),
      }),
    [t],
  );
  const { control, handleSubmit, formState, reset, watch, trigger, setFocus } =
    useForm<Application>({
      resolver: zodResolver(schema),
      defaultValues: savedDraft,
    });
  useEffect(() => {
    if (!showForm) return;
    if (applicationStep === 2) reviewHeadingRef.current?.focus();
    else setFocus(applicationStep === 0 ? 'name' : 'slug');
  }, [applicationStep, showForm, setFocus]);
  const advancingStep = useRef(false);
  const nextStep = async () => {
    if (advancingStep.current) return;
    advancingStep.current = true;
    const fields: (keyof Application)[] =
      applicationStep === 0 ? ['name', 'description'] : ['slug'];
    try {
      if (await trigger(fields, { shouldFocus: true })) {
        setFormError(null);
        setApplicationStep(Math.min(2, applicationStep + 1));
      }
    } finally {
      advancingStep.current = false;
    }
  };
  useEffect(() => {
    const subscription = watch((draft) =>
      saveDraft({
        name: draft.name ?? '',
        slug: draft.slug ?? '',
        description: draft.description ?? '',
      }),
    );
    return () => subscription.unsubscribe();
  }, [watch, saveDraft]);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchEntryMe();
      setData(next);
      setAvailableTenants(next.memberships);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [setAvailableTenants]);
  useEffect(() => {
    void load();
  }, [load]);
  const submit = handleSubmit(async (draft) => {
    setFormError(null);
    try {
      await submitTenantApplication(draft);
      clearDraft(emptyApplication);
      reset(emptyApplication);
      setShowForm(false);
      setApplicationStep(0);
      await load();
    } catch (reason) {
      const code = (reason as { code?: string }).code;
      setFormError(code ?? 'UNKNOWN');
    }
  });
  const openCommunity = async (slug: string) => {
    if (selectedSlug) return;
    setSelectedSlug(slug);
    setSelectionError(null);
    try {
      if (await doSwitchTenant(slug)) navigate(`/t/${slug}/`);
      else setSelectionError(slug);
    } catch {
      setSelectionError(slug);
    } finally {
      setSelectedSlug(null);
    }
  };
  const closeSearch = () => {
    setSearch('');
    setShowSearch(false);
    searchButtonRef.current?.focus();
  };
  const memberships = data?.memberships ?? [];
  const applications = (
    data?.tenant_applications ??
    data?.pending_tenant_applications ??
    []
  ).filter(
    (app) =>
      app.status !== 'approved' ||
      !memberships.some((m) => m.tenant_slug === app.slug),
  );
  const query = search.trim().toLocaleLowerCase();
  const filteredMemberships = memberships.filter((m) =>
    `${m.display_name ?? ''} ${m.tenant_slug}`
      .toLocaleLowerCase()
      .includes(query),
  );
  const filteredApplications = applications.filter((app) =>
    app.slug.toLocaleLowerCase().includes(query),
  );
  const status: Record<string, string> = {
    pending: t('На рассмотрении', 'Under review'),
    provisioning: t('Сообщество подготавливается', 'Preparing community'),
    approved: t('Сообщество готово', 'Community ready'),
    rejected: t('Заявка отклонена', 'Application declined'),
  };
  const submitError =
    formError === 'SLUG_TAKEN' || formError === 'TENANT_SLUG_TAKEN'
      ? t(
          'Этот адрес уже занят. Выберите другой.',
          'This address is already taken. Choose another.',
        )
      : formError === 'RATE_LIMITED'
        ? t(
            'Достигнут лимит заявок. Повторите позднее.',
            'Application limit reached. Try again later.',
          )
        : t(
            'Не удалось отправить заявку. Введённые данные сохранены.',
            'Could not submit your application. Your input is preserved.',
          );

  return (
    <main className="space-chooser" id="main-content">
      {guard}
      <header className="space-chooser__topbar">
        <Link className="space-chooser__brand" to="/">
          UpdSpace<span aria-hidden="true">.</span>
        </Link>
        <div className="space-chooser__account">
          <AuthActions
            extraItems={
              user?.isSuperuser
                ? [
                    {
                      text: t('Рассмотреть заявки', 'Review applications'),
                      action: () => setShowReview(true),
                    },
                  ]
                : []
            }
          />
        </div>
      </header>
      <div className="space-chooser__content">
        <div className="space-chooser__welcome">
          <p>
            {t('С возвращением', 'Welcome back')}{' '}
            <span aria-hidden="true">✦</span>
          </p>
          <h1>{t('В какой спейс сегодня?', 'Where to today?')}</h1>
        </div>
        <section
          aria-labelledby="communities-heading"
          className="space-chooser__spaces"
        >
          <div className="space-chooser__toolbar">
            <h2 id="communities-heading">{t('Сообщества', 'Communities')}</h2>
            <div className="space-chooser__tools">
              {applications.length > 0 && (
                <Button
                  view="flat"
                  size="xl"
                  aria-label={t('Обновить статус', 'Refresh status')}
                  title={t('Обновить статус', 'Refresh status')}
                  disabled={loading}
                  loading={loading}
                  onClick={() => void load()}
                >
                  <Icon data={ArrowRotateRight} size={20} />
                </Button>
              )}
              <Button
                ref={searchButtonRef}
                view="flat"
                size="xl"
                aria-label={
                  showSearch
                    ? t('Закрыть поиск', 'Close search')
                    : t('Поиск сообществ', 'Find communities')
                }
                aria-expanded={showSearch}
                aria-controls="community-search"
                onClick={() =>
                  showSearch ? closeSearch() : setShowSearch(true)
                }
              >
                <Icon data={showSearch ? Xmark : Magnifier} size={20} />
              </Button>
              <Button
                view="action"
                size="xl"
                aria-label={t('Создать сообщество', 'Create a community')}
                title={t('Создать сообщество', 'Create a community')}
                onClick={() => setShowForm(true)}
              >
                <Icon data={Plus} size={20} />
              </Button>
            </div>
          </div>
          {showSearch && (
            <div id="community-search" className="space-chooser__search">
              <TextInput
                autoFocus
                size="xl"
                value={search}
                onUpdate={setSearch}
                hasClear
                placeholder={t('Найти сообщество', 'Find a community')}
                controlProps={{
                  'aria-label': t('Найти сообщество', 'Find a community'),
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closeSearch();
                  }
                }}
              />
            </div>
          )}
          {error && (
            <InlineError onRetry={() => void load()}>
              {t(
                'Не удалось загрузить сообщества и заявки. Повторите попытку.',
                'Could not load communities and applications. Try again.',
              )}
            </InlineError>
          )}
          {loading && !data && (
            <div
              className="space-chooser__skeleton"
              role="status"
              aria-label={t('Загружаем сообщества', 'Loading communities')}
              aria-busy="true"
            >
              <span className="space-chooser__sr-only">
                {t('Загружаем сообщества', 'Loading communities')}
              </span>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="space-chooser__skeleton-row"
                  aria-hidden="true"
                >
                  <Skeleton className="space-chooser__skeleton-avatar" />
                  <div>
                    <Skeleton className="space-chooser__skeleton-name" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && (
            <div className="space-chooser__list" aria-busy={loading}>
              {filteredMemberships.map((m) => (
                <article className="space-chooser__item" key={m.tenant_id}>
                  <button
                    type="button"
                    className="space-chooser__community"
                    disabled={selectedSlug !== null || m.status !== 'active'}
                    aria-label={`${t('Открыть сообщество', 'Open community')} ${m.display_name || m.tenant_slug}`}
                    aria-busy={selectedSlug === m.tenant_slug}
                    onClick={() => void openCommunity(m.tenant_slug)}
                  >
                    <CommunityMark name={m.display_name || m.tenant_slug} />
                    <span className="space-chooser__identity">
                      <strong>{m.display_name || m.tenant_slug}</strong>
                      {selectedSlug === m.tenant_slug && (
                        <span>{t('Открываем…', 'Opening…')}</span>
                      )}
                    </span>
                    <Icon data={ArrowRight} size={20} />
                  </button>
                  {m.status !== 'active' && (
                    <p className="space-chooser__note">
                      {t(
                        'Ваш доступ к этому сообществу сейчас неактивен.',
                        'Your access to this community is currently inactive.',
                      )}
                    </p>
                  )}
                  {selectionError === m.tenant_slug && (
                    <InlineError>
                      {t(
                        'Не удалось открыть сообщество. Повторите попытку.',
                        'Unable to open community. Try again.',
                      )}
                    </InlineError>
                  )}
                </article>
              ))}
              {filteredApplications.map((app) => (
                <article key={app.id} className="space-chooser__application">
                  <strong>{app.name || app.slug}</strong>
                  <span className="space-chooser__status">
                    {status[app.status] ??
                      t('Статус уточняется', 'Status unavailable')}
                  </span>
                </article>
              ))}
              {query &&
                !filteredMemberships.length &&
                !filteredApplications.length && (
                  <div className="space-chooser__empty-search">
                    <p>{t('Ничего не нашлось', 'No matches yet')}</p>
                    <Button view="flat" size="l" onClick={() => setSearch('')}>
                      {t('Сбросить поиск', 'Clear search')}
                    </Button>
                  </div>
                )}
            </div>
          )}
          {data && !memberships.length && !query && (
            <div className="space-chooser__start">
              <p>
                {t(
                  'У вас пока нет сообществ. Выберите, как начать.',
                  'You have no communities yet. Choose how to start.',
                )}
              </p>
              <div className="space-chooser__paths">
                <article>
                  <h3>
                    {t('Присоединиться по приглашению', 'Join by invitation')}
                  </h3>
                  <p>
                    {t(
                      'Получите ссылку у администратора.',
                      'Ask your administrator for a link.',
                    )}
                  </p>
                  <Button
                    view="outlined"
                    size="xl"
                    onClick={() => setShowJoin(true)}
                  >
                    {t('Как присоединиться', 'How to join')}
                  </Button>
                </article>
                <article>
                  <h3>{t('Создать сообщество', 'Create a community')}</h3>
                  <p>
                    {t(
                      'Соберите своих в новом спейсе.',
                      'Bring your people to a new space.',
                    )}
                  </p>
                  <Button
                    view="outlined"
                    size="xl"
                    onClick={() => setShowForm(true)}
                  >
                    {t('Подать заявку', 'Apply')}
                  </Button>
                </article>
              </div>
            </div>
          )}
          {data && memberships.length > 0 && (
            <Button
              view="flat"
              size="l"
              className="space-chooser__invite"
              onClick={() => setShowJoin(true)}
            >
              {t('Есть приглашение?', 'Have an invitation?')}
            </Button>
          )}
        </section>
      </div>
      {showJoin && (
        <ContentDialog
          title={t('Присоединиться по приглашению', 'Join by invitation')}
          onClose={() => setShowJoin(false)}
        >
          <p>
            {t(
              'Откройте полученную ссылку в этой вкладке. Если ссылки нет, свяжитесь с администратором сообщества.',
              'Open your invitation link in this tab. If you do not have a link, contact your community administrator.',
            )}
          </p>
        </ContentDialog>
      )}
      {showForm && (
        <ContentDialog
          title={t('Новое сообщество', 'New community')}
          onClose={() => setShowForm(false)}
          busy={formState.isSubmitting}
        >
          <form
            className="space-chooser__form"
            onSubmit={(event) => {
              if (applicationStep < 2) {
                event.preventDefault();
                void nextStep();
              } else void submit(event);
            }}
          >
            <div
              className="space-chooser__progress"
              role="status"
              aria-label={t(
                `Шаг ${applicationStep + 1} из 3`,
                `Step ${applicationStep + 1} of 3`,
              )}
            >
              <span>
                {t(
                  `Шаг ${applicationStep + 1} из 3`,
                  `Step ${applicationStep + 1} of 3`,
                )}
              </span>
              <div aria-hidden="true">
                {[0, 1, 2].map((step) => (
                  <span key={step} data-complete={step <= applicationStep} />
                ))}
              </div>
            </div>
            {applicationStep === 0 && (
              <>
                <div className="space-chooser__step-intro">
                  <h3>
                    {t('Как назовём ваш спейс?', 'What’s your space called?')}
                  </h3>
                  <p>
                    {t(
                      'Название увидят все участники.',
                      'This is the name your members will see.',
                    )}
                  </p>
                </div>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormField
                      label={t('Название', 'Name')}
                      error={formState.errors.name?.message}
                    >
                      {(props) => (
                        <TextInput
                          {...props}
                          controlRef={field.ref}
                          size="xl"
                          value={field.value}
                          onUpdate={field.onChange}
                          disabled={formState.isSubmitting}
                        />
                      )}
                    </FormField>
                  )}
                />
                <Controller
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormField
                      label={t('Описание', 'Description')}
                      error={formState.errors.description?.message}
                    >
                      {(props) => (
                        <TextArea
                          {...props}
                          size="xl"
                          value={field.value}
                          onUpdate={field.onChange}
                          disabled={formState.isSubmitting}
                        />
                      )}
                    </FormField>
                  )}
                />
              </>
            )}
            {applicationStep === 1 && (
              <>
                <div className="space-chooser__step-intro">
                  <h3>{t('Где будем встречаться?', 'Make it easy to find')}</h3>
                  <p>
                    {t(
                      'Выберите короткий адрес для ссылок на сообщество.',
                      'Choose a short address for links to your community.',
                    )}
                  </p>
                </div>
                <Controller
                  control={control}
                  name="slug"
                  render={({ field }) => (
                    <FormField
                      label={t('Адрес сообщества', 'Community address')}
                      hint={`/t/${watch('slug') || 'my-community'}/`}
                      error={formState.errors.slug?.message}
                    >
                      {(props) => (
                        <TextInput
                          {...props}
                          controlRef={field.ref}
                          size="xl"
                          value={field.value}
                          onUpdate={field.onChange}
                          disabled={formState.isSubmitting}
                        />
                      )}
                    </FormField>
                  )}
                />
              </>
            )}
            {applicationStep === 2 && (
              <>
                <div className="space-chooser__step-intro">
                  <h3 tabIndex={-1} ref={reviewHeadingRef}>
                    {t('Всё готово?', 'Ready to send?')}
                  </h3>
                  <p>
                    {t(
                      'После рассмотрения и настройки ваш спейс появится в списке.',
                      'Your space will appear in the list after review and setup.',
                    )}
                  </p>
                </div>
                <div className="space-chooser__preview">
                  <CommunityMark name={watch('name')} />
                  <strong>{watch('name')}</strong>
                </div>
                {watch('description').trim() && (
                  <p className="space-chooser__description">
                    {watch('description')}
                  </p>
                )}
                <div className="space-chooser__address-review">
                  <span>
                    {t('Адрес', 'Address')}
                    <strong>/t/{watch('slug').trim().toLowerCase()}/</strong>
                  </span>
                  <Button
                    view="flat"
                    size="l"
                    disabled={formState.isSubmitting}
                    onClick={() => setApplicationStep(1)}
                  >
                    {t('Изменить адрес', 'Edit address')}
                  </Button>
                </div>
              </>
            )}
            {formError && <InlineError>{submitError}</InlineError>}
            <div className="space-chooser__form-actions">
              {applicationStep > 0 && (
                <Button
                  view="flat"
                  size="xl"
                  disabled={formState.isSubmitting}
                  onClick={() => setApplicationStep((step) => step - 1)}
                >
                  {t('Назад', 'Back')}
                </Button>
              )}
              <Button
                type="submit"
                view="action"
                size="xl"
                loading={formState.isSubmitting}
                disabled={formState.isSubmitting}
              >
                {applicationStep === 2
                  ? t('Отправить заявку', 'Submit application')
                  : t('Продолжить', 'Continue')}
              </Button>
            </div>
          </form>
        </ContentDialog>
      )}
      {showReview && user?.isSuperuser && (
        <ContentDialog
          title={t('Рассмотрение заявок', 'Review applications')}
          onClose={() => setShowReview(false)}
        >
          <TenantApplicationReviewPanel onReviewed={() => void load()} />
        </ContentDialog>
      )}
    </main>
  );
}
