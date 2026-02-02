import React from 'react';
import { Button, Card, Text, Icon, Link } from '@gravity-ui/uikit';
import { Server, ArrowRotateLeft, CircleQuestion, House } from '@gravity-ui/icons';
import { useNavigate, useLocation } from 'react-router-dom';

import { env } from '../shared/config/env';
import type { ApiErrorKind } from '../api/client';

type ServiceUnavailablePageProps = {
  /** Error kind for context-specific messaging */
  errorKind?: ApiErrorKind;
  /** Request ID for support tracking */
  requestId?: string | null;
  /** Service name that failed */
  serviceName?: string;
  /** Custom error message */
  message?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Show back to previous page button */
  showBackButton?: boolean;
};

const ERROR_MESSAGES: Record<ApiErrorKind, { title: string; description: string }> = {
  network: {
    title: 'Нет подключения к серверу',
    description:
      'Не удалось связаться с сервером. Проверьте подключение к интернету или попробуйте позже.',
  },
  server: {
    title: 'Сервис временно недоступен',
    description:
      'Мы уже знаем о проблеме и работаем над её устранением. Обычно это занимает несколько минут.',
  },
  unauthorized: {
    title: 'Требуется авторизация',
    description: 'Для доступа к этой странице необходимо войти в аккаунт.',
  },
  forbidden: {
    title: 'Доступ запрещён',
    description: 'У вас нет прав для просмотра этой страницы.',
  },
  not_found: {
    title: 'Страница не найдена',
    description: 'Запрошенная страница не существует или была удалена.',
  },
  unknown: {
    title: 'Что-то пошло не так',
    description: 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.',
  },
};

export const ServiceUnavailablePage: React.FC<ServiceUnavailablePageProps> = ({
  errorKind = 'server',
  requestId,
  serviceName,
  message,
  onRetry,
  showBackButton = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const errorInfo = ERROR_MESSAGES[errorKind] || ERROR_MESSAGES.unknown;
  const isServerError = errorKind === 'server' || errorKind === 'network';

  const getTrackerUrl = (): string => {
    const baseUrl = env.supportTrackerUrl || 'https://github.com/updatingspace/aef-vote/issues/new';

    const params = new URLSearchParams();
    params.set('title', `[Service] ${errorInfo.title}: ${serviceName || 'Unknown'}`);

    let body = '## Описание проблемы\n\n';
    body += `**Тип ошибки:** ${errorKind}\n`;
    body += `**URL:** ${window.location.href}\n`;
    body += `**Время:** ${new Date().toISOString()}\n`;
    if (serviceName) {
      body += `**Сервис:** ${serviceName}\n`;
    }
    if (requestId) {
      body += `**Request ID:** \`${requestId}\`\n`;
    }
    body += '\n## Дополнительная информация\n\n';
    body += 'Опишите, что вы делали перед возникновением ошибки:\n\n';

    params.set('body', body);
    params.set('labels', 'bug,service-unavailable');

    return `${baseUrl}?${params.toString()}`;
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="service-unavailable-container">
      <Card view="filled" className="service-unavailable-card">
        <div className="service-unavailable-icon">
          <Icon data={Server} size={56} />
        </div>

        <Text variant="header-1" className="service-unavailable-title">
          {errorInfo.title}
        </Text>

        <Text variant="body-1" color="secondary" className="service-unavailable-description">
          {message || errorInfo.description}
        </Text>

        {serviceName && (
          <div className="service-unavailable-service">
            <Text variant="body-2" color="hint">
              Сервис: <Text variant="code-1" as="span">{serviceName}</Text>
            </Text>
          </div>
        )}

        {isServerError && (
          <div className="service-unavailable-status">
            <div className="status-indicator status-indicator-warning" />
            <Text variant="body-2" color="secondary">
              Мы работаем над восстановлением
            </Text>
          </div>
        )}

        {requestId && (
          <div className="service-unavailable-request-id">
            <Text variant="body-2" color="secondary">
              ID запроса:{' '}
              <Text variant="code-1" as="span" className="request-id-value">
                {requestId}
              </Text>
            </Text>
            <Text variant="caption-1" color="hint" className="request-id-hint">
              Сохраните этот идентификатор — он поможет найти причину ошибки
            </Text>
          </div>
        )}

        <div className="service-unavailable-actions">
          <Button view="action" size="l" onClick={handleRetry} width="max">
            <Icon data={ArrowRotateLeft} size={16} />
            Попробовать снова
          </Button>

          {showBackButton && location.key !== 'default' && (
            <Button view="outlined" size="l" onClick={handleGoBack} width="max">
              Вернуться назад
            </Button>
          )}

          <Button view="flat" size="l" onClick={handleGoHome} width="max">
            <Icon data={House} size={16} />
            На главную
          </Button>
        </div>

        <div className="service-unavailable-support">
          <Text variant="body-2" color="hint" className="support-text">
            Проблема сохраняется?
          </Text>
          <Link href={getTrackerUrl()} target="_blank" rel="noopener noreferrer">
            <Icon data={CircleQuestion} size={14} />
            Создать тикет в поддержку
          </Link>
        </div>
      </Card>

      <style>{`
        .service-unavailable-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 80vh;
          padding: 24px;
        }
        .service-unavailable-card {
          max-width: 480px;
          width: 100%;
          padding: 48px 40px;
          text-align: center;
        }
        .service-unavailable-icon {
          color: var(--g-color-text-warning);
          margin-bottom: 24px;
        }
        .service-unavailable-title {
          display: block;
          margin-bottom: 12px;
        }
        .service-unavailable-description {
          display: block;
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .service-unavailable-service {
          margin-bottom: 16px;
        }
        .service-unavailable-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--g-color-base-warning-light);
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }
        .status-indicator-warning {
          background: var(--g-color-text-warning);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .service-unavailable-request-id {
          background: var(--g-color-base-generic);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .request-id-value {
          user-select: all;
        }
        .request-id-hint {
          display: block;
          margin-top: 8px;
        }
        .service-unavailable-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .service-unavailable-support {
          padding-top: 20px;
          border-top: 1px solid var(--g-color-line-generic);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .support-text {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};
