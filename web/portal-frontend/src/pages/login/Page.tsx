import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card } from '@gravity-ui/uikit';

import { redirectToLogin } from '../../modules/portal/auth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/app';

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
