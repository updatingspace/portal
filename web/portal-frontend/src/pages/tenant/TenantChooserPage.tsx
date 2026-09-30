import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Label, TextArea, TextInput } from '@gravity-ui/uikit';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { fetchEntryMe, submitTenantApplication, type EntryMeResponse } from '../../api/tenant';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantContext } from '../../contexts/TenantContext';
import { AuthActions } from '../../widgets/app-shell/AuthActions';
import { ThemeSelect } from '../../widgets/app-shell/ThemeSelect';
import { FormField, InlineError, PageLayout, PageState, useUITranslation } from '../../shared/ui/portal/PortalUI';
import { TenantApplicationReviewPanel } from './TenantApplicationReviewPanel';

const applicationSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(128, 'Не более 128 символов'),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/, 'Латинские буквы, цифры и дефис; не более 32 символов').refine((s) => !['www','portal','api','id','admin','app','support','docs'].includes(s), 'Этот адрес зарезервирован'),
  description: z.string().trim().max(4000, 'Не более 4000 символов'),
});
type Application = z.infer<typeof applicationSchema>;

export function TenantChooserPage() {
  const {user} = useAuth();
  const {doSwitchTenant, setAvailableTenants} = useTenantContext();
  const navigate = useNavigate();
  const t = useUITranslation();
  const [data, setData] = useState<EntryMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const {control, handleSubmit, formState, reset, watch} = useForm<Application>({resolver: zodResolver(applicationSchema), defaultValues: {name: '', slug: '', description: ''}});
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {const next = await fetchEntryMe(); setData(next); setAvailableTenants(next.memberships);} catch {setError('Не удалось загрузить сообщества и заявки. Повторите попытку.');} finally {setLoading(false);}
  }, [setAvailableTenants]);
  useEffect(() => {void load();}, [load]);
  const submit = handleSubmit(async (draft) => {
    setFormError(null);
    try {await submitTenantApplication(draft); reset(); setShowForm(false); await load();} catch (reason) {
      const code = (reason as {code?: string}).code;
      setFormError(code === 'SLUG_TAKEN' || code === 'TENANT_SLUG_TAKEN' ? 'Этот адрес уже занят. Выберите другой.' : code === 'RATE_LIMITED' ? 'Достигнут лимит заявок. Повторите позднее.' : 'Не удалось отправить заявку. Введённые данные сохранены.');
    }
  });
  const applications = data?.tenant_applications ?? data?.pending_tenant_applications ?? [];
  const memberships = data?.memberships ?? [];
  const status: Record<string, string> = {pending: t('На рассмотрении', 'Under review'), provisioning: t('Сообщество подготавливается', 'Preparing community'), approved: t('Сообщество готово', 'Community ready'), rejected: t('Заявка отклонена', 'Application declined')};
  return <PageLayout title={t('Мои сообщества', 'My communities')} description={user?.displayName || user?.email || undefined} actions={<><ThemeSelect /><AuthActions /><Button loading={loading} disabled={loading} onClick={() => void load()}>{t('Обновить статус', 'Refresh status')}</Button></>}>
    <div className="portal-stack">
      {error && <InlineError onRetry={() => void load()}>{error}</InlineError>}
      {loading && !data && <PageState kind="loading" title={t('Загружаем сообщества', 'Loading communities')} />}
      {memberships.length > 5 && <TextInput value={search} onUpdate={setSearch} placeholder={t('Найти сообщество', 'Find a community')} aria-label={t('Поиск сообществ', 'Find communities')} />}
      {!!memberships.length && <section className="portal-grid">{memberships.filter((m) => `${m.display_name} ${m.tenant_slug}`.toLowerCase().includes(search.toLowerCase())).map((m) => <article className="portal-card" key={m.tenant_id}>
        <span className="portal-eyebrow">/{m.tenant_slug}</span><h2>{m.display_name || m.tenant_slug}</h2>
        {m.status === 'active' ? <Button view="action" disabled={selectedSlug !== null} loading={selectedSlug === m.tenant_slug} onClick={() => {if (selectedSlug) return; setSelectedSlug(m.tenant_slug); setSelectionError(null); void doSwitchTenant(m.tenant_slug).then((success) => {if (success) navigate(`/t/${m.tenant_slug}/`); else setSelectionError(m.tenant_slug);}).catch(() => setSelectionError(m.tenant_slug)).finally(() => setSelectedSlug(null));}}>{t('Открыть сообщество', 'Open community')}</Button> : <p>{t('Ваш доступ к этому сообществу сейчас неактивен.', 'Your access to this community is currently inactive.')}</p>}
        {selectionError === m.tenant_slug && <InlineError>{t('Не удалось открыть сообщество. Повторите попытку.', 'Unable to open community. Try again.')}</InlineError>}
      </article>)}</section>}
      {data && !memberships.length && <p>{t('У вас пока нет сообществ. Выберите, как начать.', 'You have no communities yet. Choose how to start.')}</p>}
      {data && <section className="portal-grid">
        <article className="portal-card"><h2>{t('Присоединиться по приглашению', 'Join by invitation')}</h2><p>{t('Приглашение выдаёт администратор вашего сообщества.', 'Ask your community administrator for an invitation.')}</p><Button view="outlined" size="l" onClick={() => setShowJoin(!showJoin)}>{t('Как присоединиться', 'How to join')}</Button>{showJoin && <p>{t('Откройте полученную ссылку в этой вкладке. Если ссылки нет, свяжитесь с администратором сообщества.', 'Open your invitation link in this tab. If you do not have a link, contact your community administrator.')}</p>}</article>
        <article className="portal-card"><h2>{t('Создать сообщество', 'Create a community')}</h2><p>{t('Подайте заявку. После рассмотрения сообщество появится в вашем списке.', 'Apply to create a community. It will appear here after review and setup.')}</p><Button view="outlined" size="l" onClick={() => setShowForm(!showForm)}>{t('Подать заявку', 'Apply')}</Button></article>
      </section>}
      {showForm && <form className="portal-card" onSubmit={submit}><h2>{t('Новое сообщество', 'New community')}</h2>
        <Controller control={control} name="name" render={({field}) => <FormField label={t('Название', 'Name')} error={formState.errors.name?.message}>{(props) => <TextInput {...props} value={field.value} onUpdate={field.onChange} disabled={formState.isSubmitting} />}</FormField>} />
        <Controller control={control} name="slug" render={({field}) => <FormField label={t('Адрес сообщества', 'Community address')} hint={`/t/${watch('slug') || 'my-community'}/`} error={formState.errors.slug?.message}>{(props) => <TextInput {...props} value={field.value} onUpdate={field.onChange} disabled={formState.isSubmitting} />}</FormField>} />
        <Controller control={control} name="description" render={({field}) => <FormField label={t('Описание', 'Description')} error={formState.errors.description?.message}>{(props) => <TextArea {...props} value={field.value} onUpdate={field.onChange} disabled={formState.isSubmitting} />}</FormField>} />
        <p>{t('Заявка будет связана с вашим аккаунтом и отправлена на рассмотрение.', 'This application will be associated with your account and sent for review.')}</p>
        {formError && <InlineError>{formError}</InlineError>}<Button type="submit" view="action" size="l" loading={formState.isSubmitting} disabled={formState.isSubmitting}>{t('Отправить заявку', 'Submit application')}</Button>
      </form>}
      {!!applications.length && <section className="portal-card"><h2>{t('Мои заявки', 'My applications')}</h2><div className="portal-stack">{applications.map((app) => <div key={app.id} className="portal-actions"><strong>/{app.slug}</strong><Label>{status[app.status] ?? t('Статус уточняется', 'Status unavailable')}</Label></div>)}</div></section>}
      {user?.isSuperuser && <TenantApplicationReviewPanel onReviewed={() => void load()} />}
    </div>
  </PageLayout>;
}
