import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  type EntryMeResponse,
  type TenantSummary,
  fetchEntryMe,
  submitTenantApplication,
} from '../../api/tenant';
import { useTenantContext } from '../../contexts/TenantContext';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { AppLoader } from '../../shared/ui/AppLoader';
import { logger } from '../../utils/logger';

import './TenantChooserPage.css';

type PageState = 'loading' | 'ready' | 'error';

const isActiveMembership = (tenant: TenantSummary): boolean =>
  String(tenant.status || '').trim().toLowerCase() === 'active';

const resolveTenantDisplayName = (tenant: TenantSummary): string => {
  const displayName =
    typeof tenant.display_name === 'string' ? tenant.display_name.trim() : '';
  if (displayName) return displayName;
  return tenant.tenant_slug || 'Сообщество';
};

export const TenantChooserPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  useDocumentTitle('Выбор сообщества');

  const { doSwitchTenant, errorMessage: tenantErrorMessage } = useTenantContext();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [entryData, setEntryData] = useState<EntryMeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const memberships = entryData?.memberships ?? [];
  const pendingApplications = entryData?.pending_tenant_applications ?? [];

  const activeMemberships = useMemo(
    () => memberships.filter((tenant) => isActiveMembership(tenant)),
    [memberships],
  );
  const inactiveMemberships = useMemo(
    () => memberships.filter((tenant) => !isActiveMembership(tenant)),
    [memberships],
  );

  const hasAnyMemberships = memberships.length > 0;
  const hasActiveMemberships = activeMemberships.length > 0;
  const hasPendingApplications = pendingApplications.length > 0;

  const applyEntryData = useCallback((data: EntryMeResponse) => {
    setEntryData(data);
    setNewEmail(typeof data.user?.email === 'string' ? data.user.email.trim() : '');
    setShowCreateForm(data.memberships.length === 0 && data.pending_tenant_applications.length === 0);
    setPageState('ready');
  }, []);

  const loadEntryData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setPageState('loading');
      }
      setErrorMsg(null);
      try {
        const data = await fetchEntryMe();
        applyEntryData(data);
      } catch (err) {
        logger.error('Failed to load entry/me', { error: err });
        setErrorMsg('Не удалось загрузить список tenant.');
        setPageState('error');
      }
    },
    [applyEntryData],
  );

  useEffect(() => {
    loadEntryData();
  }, [loadEntryData]);

  const handleSelectTenant = useCallback(
    async (tenant: TenantSummary) => {
      const tenantSlug = String(tenant.tenant_slug || '').trim();
      const tenantName = resolveTenantDisplayName(tenant);
      if (!tenantSlug) {
        setErrorMsg('Не удалось определить slug сообщества. Обновите страницу.');
        return;
      }

      if (!isActiveMembership(tenant)) {
        setErrorMsg(`Сообщество «${tenantName}» пока недоступно (статус membership не active).`);
        return;
      }

      setErrorMsg(null);
      const success = await doSwitchTenant(tenantSlug);
      if (success) {
        navigate(`/t/${tenantSlug}/`, { replace: true });
        return;
      }

      setErrorMsg(
        `Не удалось переключиться на «${tenantName}». ${tenantErrorMessage || 'Попробуйте ещё раз.'}`,
      );
    },
    [doSwitchTenant, navigate, tenantErrorMessage],
  );

  const handleCreateApplication = useCallback(async () => {
    if (!newSlug.trim()) return;
    const email = newEmail.trim();

    if (!email) {
      setErrorMsg('Укажите email для заявки.');
      return;
    }

    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailLooksValid) {
      setErrorMsg('Укажите корректный email.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await submitTenantApplication({
        slug: newSlug.trim().toLowerCase(),
        name: newName.trim() || newSlug.trim(),
        description: newDescription.trim(),
        email,
      });

      setNewSlug('');
      setNewName('');
      setNewDescription('');
      await loadEntryData({ silent: true });
      setShowCreateForm(false);
    } catch (err) {
      logger.error('Failed to submit application', { error: err });
      setErrorMsg('Не удалось отправить заявку.');
    } finally {
      setSubmitting(false);
    }
  }, [loadEntryData, newDescription, newEmail, newName, newSlug]);

  const handleRefresh = useCallback(async () => {
    setReloading(true);
    await loadEntryData({ silent: true });
    setReloading(false);
  }, [loadEntryData]);

  if (pageState === 'loading') {
    return <AppLoader />;
  }

  return (
    <div className="tenant-chooser">
      <div className="tenant-chooser__panel">
        <div className="tenant-chooser__header">
          <div>
            <h1 className="tenant-chooser__title">Portal Updating Space</h1>
            <p className="tenant-chooser__subtitle">Выберите сообщество</p>
          </div>
          <div className="tenant-chooser__actions">
            <button
              type="button"
              className="tenant-chooser__action-btn tenant-chooser__action-btn--secondary"
              onClick={handleRefresh}
              disabled={reloading}
            >
              {reloading ? 'Обновление...' : 'Обновить статус'}
            </button>
            <button
              type="button"
              className="tenant-chooser__action-btn tenant-chooser__action-btn--primary"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              {showCreateForm ? 'Скрыть создание' : 'Создать сообщество'}
            </button>
          </div>
        </div>

        {reason === 'forbidden' && (
          <div className="tenant-chooser__alert tenant-chooser__alert--warning">
            У вас нет доступа к запрашиваемому сообществу.
          </div>
        )}

        {errorMsg && (
          <div className="tenant-chooser__alert tenant-chooser__alert--error">
            {errorMsg}
          </div>
        )}

        {pageState === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="tenant-chooser__action-btn tenant-chooser__action-btn--secondary"
            type="button"
          >
            Повторить
          </button>
        )}

        {pageState === 'ready' && hasActiveMemberships && (
          <div className="tenant-chooser__tenant-grid">
            {activeMemberships.map((tenant) => (
              <button
                key={tenant.tenant_id}
                type="button"
                className="tenant-chooser__tenant-card"
                onClick={() => handleSelectTenant(tenant)}
              >
                <div className="tenant-chooser__tenant-name">
                  {resolveTenantDisplayName(tenant)}
                </div>
                <div className="tenant-chooser__tenant-meta">
                  <span>/{tenant.tenant_slug}</span>
                  <span>{tenant.base_role || 'member'}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {pageState === 'ready' && !hasActiveMemberships && hasAnyMemberships && (
          <div className="tenant-chooser__empty">
            Нет активных membership для входа в сообщества.
          </div>
        )}

        {pageState === 'ready' && !hasAnyMemberships && (
          <div className="tenant-chooser__empty">
            У вас пока нет сообществ. Создайте заявку:
          </div>
        )}

        {inactiveMemberships.length > 0 && (
          <div className="tenant-chooser__muted">
            Часть сообществ скрыта для входа, потому что статус membership не active.
          </div>
        )}

        {entryData?.last_tenant && (
          <div className="tenant-chooser__muted">
            Последний tenant: <strong>{entryData.last_tenant.tenant_slug}</strong>
          </div>
        )}

        {showCreateForm && (
          <div className="tenant-chooser__create-form">
            <input
              type="text"
              placeholder="Slug (например: my-community)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="tenant-chooser__input"
            />
            <input
              type="text"
              placeholder="Название"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="tenant-chooser__input"
            />
            <input
              type="email"
              placeholder="Email для заявки"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="tenant-chooser__input"
            />
            <textarea
              placeholder="Описание (необязательно)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="tenant-chooser__input tenant-chooser__textarea"
            />
            <button
              onClick={handleCreateApplication}
              disabled={submitting || !newSlug.trim() || !newEmail.trim()}
              className="tenant-chooser__action-btn tenant-chooser__action-btn--primary"
              type="button"
            >
              {submitting ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </div>
        )}

        {hasPendingApplications && (
          <div className="tenant-chooser__pending">
            <p>Ваша заявка на рассмотрении:</p>
            {pendingApplications.map((app) => (
              <div key={app.id} className="tenant-chooser__pending-item">
                <div>/{app.slug}</div>
                <div>Статус: {app.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
