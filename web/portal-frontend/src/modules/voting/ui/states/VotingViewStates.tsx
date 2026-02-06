import React from 'react';
import { Button, Card, Loader, Text } from '@gravity-ui/uikit';

export interface VotingPageStateProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
}

interface StateCardProps extends VotingPageStateProps {
  danger?: boolean;
}

const StateCard: React.FC<StateCardProps> = ({ title, message, action, danger = false }) => {
  return (
    <div className="voting-v2__state-wrap" role={danger ? 'alert' : 'status'} aria-live="polite">
      <Card className="voting-v2__state-card">
        <Text variant="subheader-2" className="voting-v2__state-title">
          {title}
        </Text>
        {message ? (
          <Text variant="body-2" color="secondary" className="voting-v2__state-message">
            {message}
          </Text>
        ) : null}
        {action ? <div className="voting-v2__state-action">{action}</div> : null}
      </Card>
    </div>
  );
};

interface LoadingStateProps {
  text?: string;
}

export const VotingLoadingState: React.FC<LoadingStateProps> = ({
  text = 'Загружаем данные…',
}) => {
  return (
    <div className="voting-v2__state-wrap" role="status" aria-live="polite" aria-busy="true">
      <Card className="voting-v2__state-card">
        <div className="voting-v2__loading-row">
          <Loader size="l" />
          <Text variant="body-2" color="secondary">
            {text}
          </Text>
        </div>
      </Card>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const VotingErrorState: React.FC<ErrorStateProps> = ({
  title = 'Не удалось загрузить данные',
  message = 'Проверьте соединение и попробуйте снова.',
  onRetry,
  retryLabel = 'Повторить',
}) => {
  return (
    <StateCard
      title={title}
      message={message}
      danger
      action={
        onRetry ? (
          <Button view="action" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
};

export const VotingEmptyState: React.FC<VotingPageStateProps> = ({ title, message, action }) => {
  return <StateCard title={title} message={message} action={action} />;
};

interface RateLimitStateProps {
  retryAfter: number;
  onRetry?: () => void;
}

export const VotingRateLimitState: React.FC<RateLimitStateProps> = ({ retryAfter, onRetry }) => {
  return (
    <StateCard
      title="Слишком много запросов"
      message={`Подождите ${retryAfter} сек. и попробуйте снова.`}
      action={
        onRetry ? (
          <Button view="action" onClick={onRetry}>
            Повторить
          </Button>
        ) : undefined
      }
    />
  );
};

interface ForbiddenStateProps {
  message?: string;
}

export const VotingForbiddenState: React.FC<ForbiddenStateProps> = ({
  message = 'У вас недостаточно прав для просмотра этой страницы.',
}) => {
  return <StateCard title="Доступ ограничен" message={message} danger />;
};
