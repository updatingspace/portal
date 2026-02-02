import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gravity-ui/uikit';

import type { ApiError } from '../../../api/client';
import { isApiError, requestResult } from '../../../api/client';
import { StatusView } from '../components/StatusView';
import { redirectToLogin } from '../auth';

type MePayload = {
  user: { id: string; master_flags?: Record<string, unknown> | null };
  tenant: { id: string; slug: string };
  portal_profile?: Record<string, unknown> | null;
  request_id?: string;
};

export function MePage() {
  const [data, setData] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestResult<MePayload>('/session/me');
      if (!res.ok) {
        if (res.status === 401) {
          setData(null);
          return;
        }
        throw new Error(res.error.message ?? 'Failed to load');
      }
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(isApiError(e) ? e : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const profile = useMemo(() => {
    const p = data?.portal_profile ?? null;
    if (!p || typeof p !== 'object') return null;
    return p;
  }, [data?.portal_profile]);

  if (loading) return <StatusView kind="loading" />;
  if (error) return <StatusView kind="error" retry={{ onClick: load }} />;

  if (!data) {
    return (
      <StatusView
        kind="unauthorized"
        title="Профиль"
        description="Чтобы увидеть профиль, нужно войти через UpdSpaceID."
        showLogin
      />
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="page-title mb-0">Мой профиль</h1>
        <Button view="outlined" onClick={() => redirectToLogin()}>
          Открыть UpdSpaceID
        </Button>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="status-block status-block-info">
            <div className="status-title">Сессия</div>
            <div className="text-muted">user_id: {data.user.id}</div>
            <div className="text-muted">tenant: {data.tenant.slug}</div>
            <div className="text-muted">request_id: {data.request_id ?? '—'}</div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="status-block status-block-info">
            <div className="status-title">Профиль портала</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
