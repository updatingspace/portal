import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card } from '@gravity-ui/uikit';

import { redirectToLogin } from '../../modules/portal/auth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/choose-tenant';
  const authErrorCode = (params.get('auth_error') ?? '').trim().toUpperCase();
  const requestId = (params.get('request_id') ?? '').trim();

  const authErrorMessage = (() => {
    if (!authErrorCode) return null;
    switch (authErrorCode) {
      case 'INVALID_STATE':
        return 'Сессия входа истекла или уже была использована. Попробуйте войти снова.';
      case 'OAUTH_ERROR':
        return 'Авторизация в UpdSpaceID была отклонена.';
      case 'TOKEN_EXCHANGE_FAILED':
      case 'USERINFO_FAILED':
      case 'UPSTREAM_UNAVAILABLE':
      case 'UPSTREAM_NOT_CONFIGURED':
        return 'Не удалось завершить вход через UpdSpaceID. Попробуйте ещё раз.';
      case 'TENANT_MISMATCH':
      case 'TENANT_NOT_FOUND':
        return 'Не удалось определить tenant для текущего входа.';
      default:
        return 'Не удалось завершить вход. Повторите попытку.';
    }
  })();

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12 col-lg-8 mx-auto">
          <Card view="filled" className="p-4">
            <div className="text-muted small mb-1">Auth</div>
            <h1 className="h3 fw-semibold mb-2">Login</h1>
            <p className="text-muted mb-4">
              This starts the UpdSpaceID flow via BFF (same-origin).
            </p>

            {authErrorMessage && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderRadius: 6,
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  Не удалось завершить вход
                </div>
                <div>{authErrorMessage}</div>
                {requestId && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6c757d' }}>
                    Request ID: {requestId}
                  </div>
                )}
              </div>
            )}

            <div className="d-flex flex-wrap gap-2">
              <Button view="action" size="l" onClick={() => redirectToLogin(next)}>
                Continue with UpdSpaceID
              </Button>
              <Button view="outlined" size="l" onClick={() => navigate('/')}>Back</Button>
            </div>

          </Card>
        </div>
      </div>
    </div>
  );
};
