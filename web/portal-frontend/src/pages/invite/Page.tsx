import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, TextInput } from '@gravity-ui/uikit';

import { requestResult } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { notifyApiError } from '../../utils/apiErrorHandling';

export const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    setIsSubmitting(true);
    try {
      // Try to activate invite via API
      const res = await requestResult('/invite/activate', {
        method: 'POST',
        body: { token, username: username.trim() || undefined },
      });

      if (!res.ok) {
        throw new Error(res.error.message ?? 'Activation failed');
      }

      setSuccess(true);
      await refreshProfile();

      // Redirect to app after short delay
      setTimeout(() => navigate('/choose-tenant'), 1500);
    } catch (e) {
      notifyApiError(e, 'Failed to activate invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container py-5">
        <div className="row">
          <div className="col-12 col-lg-8 mx-auto">
            <Alert
              theme="success"
              view="filled"
              title="Success!"
              message="Account activated. Redirecting to app..."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12 col-lg-8 mx-auto">
          <Card view="filled" className="p-4">
            <div className="text-muted small mb-1">Invite</div>
            <h1 className="h3 fw-semibold mb-2">Activate invite</h1>
            <p className="text-muted mb-4">
              Token: <span className="fw-semibold">{token}</span>
            </p>

            <div className="d-grid gap-3">
              <TextInput
                placeholder="Optional: set username"
                value={username}
                onUpdate={setUsername}
              />
              <Button
                view="action"
                size="l"
                loading={isSubmitting}
                onClick={handleActivate}
              >
                Activate
              </Button>
            </div>

          </Card>
        </div>
      </div>
    </div>
  );
};
