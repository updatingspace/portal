/**
 * TenantChooserPage — /choose-tenant route.
 *
 * Displays list of user's tenants (memberships), allows selecting one
 * or creating a new tenant via application.
 *
 * States:
 * - loading: fetching entry/me data
 * - list: show tenant cards
 * - no-memberships: no tenants, show create option
 * - pending-application: show pending application status
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  type EntryMeResponse,
  type TenantSummary,
  fetchEntryMe,
  submitTenantApplication,
} from '../../api/tenant';
import { useTenantContext } from '../../contexts/TenantContext';
import { AppLoader } from '../../shared/ui/AppLoader';
import { logger } from '../../utils/logger';

type PageState = 'loading' | 'list' | 'no-memberships' | 'creating' | 'pending' | 'error';

export const TenantChooserPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  const { doSwitchTenant } = useTenantContext();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [entryData, setEntryData] = useState<EntryMeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create form state
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEntryMe();
        setEntryData(data);

        if (data.memberships.length === 0) {
          if (data.pending_tenant_applications.length > 0) {
            setPageState('pending');
          } else {
            setPageState('no-memberships');
          }
        } else {
          setPageState('list');
        }
      } catch (err) {
        logger.error('Failed to load entry/me', { error: err });
        setErrorMsg('Не удалось загрузить список tenant.');
        setPageState('error');
      }
    };

    load();
  }, []);

  const handleSelectTenant = useCallback(
    async (tenant: TenantSummary) => {
      setErrorMsg(null);
      const success = await doSwitchTenant(tenant.tenant_slug);
      if (success) {
        navigate(`/t/${tenant.tenant_slug}/`, { replace: true });
      } else {
        setErrorMsg(
          `Не удалось переключиться на «${tenant.display_name}». Попробуйте ещё раз.`,
        );
      }
    },
    [doSwitchTenant, navigate],
  );

  const handleCreateApplication = useCallback(async () => {
    if (!newSlug.trim()) return;
    setSubmitting(true);
    try {
      await submitTenantApplication({
        slug: newSlug.trim().toLowerCase(),
        name: newName.trim() || newSlug.trim(),
        description: newDescription.trim(),
      });
      // Refresh to show pending state
      const data = await fetchEntryMe();
      setEntryData(data);
      setPageState('pending');
    } catch (err) {
      logger.error('Failed to submit application', { error: err });
      setErrorMsg('Не удалось отправить заявку.');
    } finally {
      setSubmitting(false);
    }
  }, [newSlug, newName, newDescription]);

  if (pageState === 'loading') {
    return <AppLoader />;
  }

  return (
    <div style={{ maxWidth: 560, margin: '3rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Portal Updating Space</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>Выберите сообщество</p>

      {reason === 'forbidden' && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            marginBottom: '1rem',
          }}
        >
          У вас нет доступа к запрашиваемому сообществу.
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: 6,
            marginBottom: '1rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Tenant list */}
      {pageState === 'list' && entryData && (
        <div>
          {entryData.memberships.map((tenant) => (
            <div
              key={tenant.tenant_id}
              onClick={() => handleSelectTenant(tenant)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectTenant(tenant)}
              role="button"
              tabIndex={0}
              style={{
                padding: '1rem',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                marginBottom: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'box-shadow 0.15s',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{tenant.display_name}</div>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>/{tenant.tenant_slug}</div>
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                {tenant.base_role}
              </div>
            </div>
          ))}

          {entryData.last_tenant && (
            <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '1rem' }}>
              Последний tenant: <strong>{entryData.last_tenant.tenant_slug}</strong>
            </p>
          )}
        </div>
      )}

      {/* No memberships — show create form */}
      {pageState === 'no-memberships' && (
        <div>
          <p>У вас пока нет сообществ. Создайте заявку:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Slug (например: my-community)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
            />
            <input
              type="text"
              placeholder="Название"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
            />
            <textarea
              placeholder="Описание (необязательно)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', resize: 'vertical' }}
            />
            <button
              onClick={handleCreateApplication}
              disabled={submitting || !newSlug.trim()}
              style={{
                padding: '0.5rem 1.5rem',
                cursor: submitting ? 'wait' : 'pointer',
                borderRadius: 6,
                border: 'none',
                background: '#4a90d9',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {submitting ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </div>
        </div>
      )}

      {/* Creating form (inline toggle) */}
      {pageState === 'creating' && (
        <div>
          <p>Создание заявки на новое сообщество...</p>
        </div>
      )}

      {/* Pending application */}
      {pageState === 'pending' && entryData && (
        <div>
          <p>Ваша заявка на рассмотрении:</p>
          {entryData.pending_tenant_applications.map((app) => (
            <div
              key={app.id}
              style={{
                padding: '1rem',
                border: '1px solid #ffc107',
                borderRadius: 8,
                marginBottom: '0.75rem',
                background: '#fff8e1',
              }}
            >
              <div style={{ fontWeight: 600 }}>/{app.slug}</div>
              <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                Статус: {app.status}
              </div>
            </div>
          ))}
          <button
            onClick={async () => {
              setPageState('loading');
              const data = await fetchEntryMe();
              setEntryData(data);
              if (data.memberships.length > 0) setPageState('list');
              else if (data.pending_tenant_applications.length > 0) setPageState('pending');
              else setPageState('no-memberships');
            }}
            style={{
              padding: '0.5rem 1.5rem',
              cursor: 'pointer',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#f0f0f0',
              marginTop: '0.5rem',
            }}
          >
            Обновить статус
          </button>
        </div>
      )}

      {pageState === 'error' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1.5rem',
            cursor: 'pointer',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: '#f0f0f0',
          }}
        >
          Повторить
        </button>
      )}
    </div>
  );
};
