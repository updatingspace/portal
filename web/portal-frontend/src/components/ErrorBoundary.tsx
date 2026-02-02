import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Card, Text, Icon } from '@gravity-ui/uikit';
import { TriangleExclamation, ArrowRotateLeft, CircleQuestion } from '@gravity-ui/icons';

import { logger } from '../utils/logger';
import { env } from '../shared/config/env';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  requestId: string | null;
};

/**
 * React Error Boundary for catching unhandled errors in the component tree.
 * Displays a user-friendly error page with retry option and support link.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      requestId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Extract request_id if available from error
    const requestId = this.extractRequestId(error);

    this.setState({ errorInfo, requestId });

    // Log the error
    logger.critical('Unhandled React error', {
      area: 'error_boundary',
      event: 'component_error',
      data: {
        message: error.message,
        componentStack: errorInfo.componentStack,
        request_id: requestId ?? undefined,
      },
      error,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private extractRequestId(error: Error): string | null {
    // Try to extract request_id from error if it's an ApiError
    if ('requestId' in error && typeof (error as { requestId?: unknown }).requestId === 'string') {
      return (error as { requestId: string }).requestId;
    }
    return null;
  }

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      requestId: null,
    });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private getTrackerUrl(): string {
    const baseUrl = env.supportTrackerUrl || 'https://github.com/updatingspace/aef-vote/issues/new';
    const { error, requestId } = this.state;

    const params = new URLSearchParams();
    params.set('title', `[Bug] Frontend crash: ${error?.message?.slice(0, 50) || 'Unknown error'}`);

    let body = '## Error Details\n\n';
    body += `**Error Message:** ${error?.message || 'Unknown'}\n`;
    body += `**URL:** ${window.location.href}\n`;
    body += `**Timestamp:** ${new Date().toISOString()}\n`;
    if (requestId) {
      body += `**Request ID:** \`${requestId}\`\n`;
    }
    body += `**User Agent:** ${navigator.userAgent}\n`;
    body += '\n## Steps to Reproduce\n\n1. \n2. \n3. \n';
    body += '\n## Expected Behavior\n\n';
    body += '\n## Actual Behavior\n\n';

    params.set('body', body);
    params.set('labels', 'bug,frontend');

    return `${baseUrl}?${params.toString()}`;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, requestId } = this.state;
      const trackerUrl = this.getTrackerUrl();

      return (
        <div className="error-boundary-container">
          <Card view="filled" className="error-boundary-card">
            <div className="error-boundary-icon">
              <Icon data={TriangleExclamation} size={48} />
            </div>

            <Text variant="header-1" className="error-boundary-title">
              Что-то пошло не так
            </Text>

            <Text variant="body-1" color="secondary" className="error-boundary-description">
              Произошла неожиданная ошибка. Мы уже знаем о проблеме и работаем над её устранением.
            </Text>

            {error?.message && (
              <div className="error-boundary-details">
                <Text variant="code-1" color="secondary">
                  {error.message.length > 200 ? `${error.message.slice(0, 200)}...` : error.message}
                </Text>
              </div>
            )}

            {requestId && (
              <div className="error-boundary-request-id">
                <Text variant="body-2" color="secondary">
                  Request ID:{' '}
                  <Text variant="code-1" as="span">
                    {requestId}
                  </Text>
                </Text>
                <Text variant="caption-1" color="hint" className="error-boundary-hint">
                  Укажите этот идентификатор при обращении в поддержку
                </Text>
              </div>
            )}

            <div className="error-boundary-actions">
              <Button view="action" size="l" onClick={this.handleRetry}>
                <Icon data={ArrowRotateLeft} size={16} />
                Попробовать снова
              </Button>

              <Button view="outlined" size="l" onClick={this.handleReload}>
                Перезагрузить страницу
              </Button>

              <Button view="flat" size="l" onClick={this.handleGoHome}>
                На главную
              </Button>
            </div>

            <div className="error-boundary-support">
              <Button
                view="flat-secondary"
                size="m"
                href={trackerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon data={CircleQuestion} size={14} />
                Сообщить о проблеме
              </Button>
            </div>
          </Card>

          <style>{`
            .error-boundary-container {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 24px;
              background: var(--g-color-base-background);
            }
            .error-boundary-card {
              max-width: 520px;
              padding: 48px 40px;
              text-align: center;
            }
            .error-boundary-icon {
              color: var(--g-color-text-warning);
              margin-bottom: 24px;
            }
            .error-boundary-title {
              display: block;
              margin-bottom: 12px;
            }
            .error-boundary-description {
              display: block;
              margin-bottom: 24px;
            }
            .error-boundary-details {
              background: var(--g-color-base-generic);
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 16px;
              text-align: left;
              word-break: break-word;
            }
            .error-boundary-request-id {
              background: var(--g-color-base-info-light);
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 24px;
            }
            .error-boundary-hint {
              display: block;
              margin-top: 4px;
            }
            .error-boundary-actions {
              display: flex;
              flex-direction: column;
              gap: 12px;
              margin-bottom: 24px;
            }
            .error-boundary-support {
              padding-top: 16px;
              border-top: 1px solid var(--g-color-line-generic);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
