import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';

import type { AccessDeniedTenant } from '../../api/accessDenied';

type AccessDeniedViewProps = {
  tenant?: AccessDeniedTenant | null;
  requestId?: string | null;
  service?: string | null;
  reasonSummary?: string | null;
  showBackAction?: boolean;
  onHome: () => void;
  onBack?: () => void;
  onCopyAdminMessage: () => void;
  onCopyRequestId?: () => void;
};

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  tenant,
  requestId,
  service,
  reasonSummary,
  showBackAction = false,
  onHome,
  onBack,
  onCopyAdminMessage,
  onCopyRequestId,
}) => {
  const tenantLabel = tenant?.name?.trim() || tenant?.slug?.trim() || null;
  const tenantUuid = tenant?.id?.trim() || null;

  return (
    <section className="access-denied" aria-labelledby="access-denied-title" data-qa="access-denied-screen">
      <Card view="filled" className="access-denied__card">
        <div className="access-denied__hero">
          <svg
            className="access-denied__illustration"
            viewBox="0 0 220 160"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="52" y="24" width="116" height="96" rx="18" className="access-denied__shape-bg" />
            <rect x="72" y="44" width="76" height="56" rx="12" className="access-denied__shape-mid" />
            <path d="M92 44V36C92 25 101 16 112 16C123 16 132 25 132 36V44" className="access-denied__shape-line" />
            <circle cx="112" cy="71" r="8" className="access-denied__shape-line" />
            <path d="M112 79V90" className="access-denied__shape-line" />
            <circle cx="78" cy="126" r="2" className="access-denied__shape-dot" />
            <circle cx="145" cy="132" r="2" className="access-denied__shape-dot" />
          </svg>

          <Text variant="header-1" as="h1" id="access-denied-title">
            Доступ ограничен
          </Text>
          <Text variant="body-2" className="access-denied__description">
            У вашего аккаунта пока нет прав для просмотра этого раздела.
          </Text>
          <Text variant="body-2" color="secondary" className="access-denied__description">
            Попросите администратора tenant'а выдать доступ. Request ID поможет быстрее разобраться.
          </Text>
        </div>

        <div className="access-denied__actions">
          <Button view="action" size="l" onClick={onHome}>
            На главную
          </Button>
          {showBackAction && onBack ? (
            <Button view="outlined" size="l" onClick={onBack}>
              Назад
            </Button>
          ) : null}
          <Button view="flat" size="l" onClick={onCopyAdminMessage}>
            Скопировать сообщение администратору
          </Button>
        </div>

        <details className="access-denied__details">
          <summary>Технические детали</summary>
          <div className="access-denied__details-content">
            {requestId ? (
              <div className="access-denied__details-row">
                <Text variant="caption-2">Request ID: {requestId}</Text>
                {onCopyRequestId ? (
                  <Button view="flat" size="xs" onClick={onCopyRequestId} aria-label="Скопировать Request ID">
                    Copy
                  </Button>
                ) : null}
              </div>
            ) : null}
            {reasonSummary ? <Text variant="caption-2">Причина: {reasonSummary}</Text> : null}
            {service ? <Text variant="caption-2">Service: {service}</Text> : null}
            {tenantLabel || tenantUuid ? (
              <Text variant="caption-2">
                Tenant: {[tenantLabel, tenantUuid].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </div>
        </details>

        {requestId ? (
          <div className="access-denied__request-id">
            <Text variant="caption-2" color="secondary">Request ID: {requestId}</Text>
            {onCopyRequestId ? (
              <Button view="flat" size="xs" onClick={onCopyRequestId} aria-label="Скопировать Request ID снизу">
                Copy
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
};
