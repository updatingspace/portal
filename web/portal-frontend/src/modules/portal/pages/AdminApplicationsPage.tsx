import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Loader } from '@gravity-ui/uikit';

import type { ApiError } from '../../../api/client';
import { isApiError, requestResult } from '../../../api/client';
import { StatusView } from '../components/StatusView';

type Application = {
  id: number;
  tenant_slug: string;
  payload_json: Record<string, unknown>;
  status: string;
  created_at: string;
};

type ApplicationListOut = { items: Application[] };

type ApproveOut = { activation_token: string; activation_expires_at: string };

type PageState = 'loading' | 'ready' | 'unauthorized' | 'no-access' | 'error' | 'empty';

export function AdminApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await requestResult<ApplicationListOut>('/portal/applications?status=pending');
      if (!res.ok) {
        if (res.status === 401) {
          setItems([]);
          setState('unauthorized');
          return;
        }
        if (res.status === 403) {
          setItems([]);
          setState('no-access');
          return;
        }
        throw new Error(res.error.message ?? 'Failed');
      }
      const list = res.data?.items ?? [];
      setItems(list);
      setState(list.length ? 'ready' : 'empty');
    } catch (e) {
      setItems([]);
      setError(isApiError(e) ? e : null);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = useCallback(async (id: number) => {
    setBusyId(id);
    try {
      const res = await requestResult<ApproveOut>(`/portal/applications/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error.message ?? 'Failed to approve');
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const reject = useCallback(async (id: number) => {
    setBusyId(id);
    try {
      const res = await requestResult<{ ok: true }>(`/portal/applications/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error.message ?? 'Failed to reject');
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const meta = useMemo(() => {
    if (!error) return null;
    return { message: error.message };
  }, [error]);

  if (state === 'loading') {
    return (
      <div className="container py-4">
        <div className="status-block status-block-info">
          <Loader size="l" />
          <div className="text-muted mt-2">Загружаем заявки…</div>
        </div>
      </div>
    );
  }

  if (state === 'unauthorized') return <StatusView kind="unauthorized" title="Заявки" showLogin />;
  if (state === 'no-access') return <StatusView kind="no-access" title="Заявки" />;
  if (state === 'error') return <StatusView kind="error" title="Заявки" description={meta?.message} retry={{ onClick: load }} />;
  if (state === 'empty') return <StatusView kind="empty" title="Заявки" description="Пока нет заявок в статусе pending." />;

  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h1 className="page-title mb-0">Заявки (approve)</h1>
        <Button view="outlined" onClick={load}>Обновить</Button>
      </div>

      <div className="row g-3">
        {items.map((a) => (
          <div className="col-12" key={a.id}>
            <div className="status-block status-block-info">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <div className="status-title">Application #{a.id}</div>
                  <div className="text-muted">tenant: {a.tenant_slug} · status: {a.status}</div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <Button view="action" disabled={busyId === a.id} onClick={() => approve(a.id)}>
                    {busyId === a.id ? '…' : 'Approve'}
                  </Button>
                  <Button view="outlined" disabled={busyId === a.id} onClick={() => reject(a.id)}>
                    Reject
                  </Button>
                </div>
              </div>
              <pre style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(a.payload_json, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
