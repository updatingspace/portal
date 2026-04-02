/* eslint-disable react-refresh/only-export-components */
/**
 * VotingAlerts Component
 * 
 * Contextual alerts for voting states with actionable buttons.
 * 
 * Features:
 * - Contextual alerts: Voting closed, Auth required, Telegram link needed
 * - Actionable buttons in alerts (Login, Link Telegram, View Results)
 * - Auto-dismiss for informational alerts
 * - Persistent for critical alerts
 * - WCAG 2.1 AA accessibility
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button } from '@gravity-ui/uikit';

// ============================================================================
// Types
// ============================================================================

export type AlertType = 'info' | 'warning' | 'success' | 'error';
export type AlertTheme = 'info' | 'warning' | 'success' | 'danger' | 'utility';

export interface VotingAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  dismissable?: boolean;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  actions?: AlertAction[];
}

export interface AlertAction {
  label: string;
  onClick: () => void;
  view?: 'normal' | 'action' | 'outlined' | 'flat';
  primary?: boolean;
}

export interface VotingAlertsProps {
  alerts: VotingAlert[];
  onDismiss?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Alert Type Mapping
// ============================================================================

function getAlertTheme(type: AlertType): AlertTheme {
  switch (type) {
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'error':
      return 'danger';
    default:
      return 'utility';
  }
}

// ============================================================================
// Single Alert Component
// ============================================================================

const SingleAlert: React.FC<{
  alert: VotingAlert;
  onDismiss?: (id: string) => void;
}> = ({ alert, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  // Auto-dismiss timer
  useEffect(() => {
    if (alert.autoDismiss && alert.autoDismissDelay) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(alert.id), 300); // Wait for fade animation
      }, alert.autoDismissDelay);
      
      return () => clearTimeout(timer);
    }
  }, [alert.autoDismiss, alert.autoDismissDelay, alert.id, onDismiss]);
  
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(alert.id), 300);
  };
  
  const theme = getAlertTheme(alert.type);
  
  if (!isVisible) return null;
  
  // Build actions for the Alert component
  const alertActions = alert.actions?.map((action, index) => (
    <Button
      key={index}
      view={action.view ?? (action.primary ? 'action' : 'outlined')}
      size="s"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  ));
  
  return (
    <Alert
      theme={theme}
      title={alert.title}
      message={alert.message}
      onClose={alert.dismissable ? handleDismiss : undefined}
      actions={alertActions}
      className={`voting-alert voting-alert--${alert.type} ${!isVisible ? 'voting-alert--hidden' : ''}`}
    />
  );
};

// ============================================================================
// Alerts Container Component
// ============================================================================

export const VotingAlerts: React.FC<VotingAlertsProps> = ({
  alerts,
  onDismiss,
  className = '',
}) => {
  if (alerts.length === 0) return null;
  
  return (
    <div className={`voting-alerts ${className}`} role="region" aria-label="Уведомления">
      {alerts.map((alert) => (
        <SingleAlert
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Helper: Create Common Alerts
// ============================================================================

export const createVotingAlerts = {
  /**
   * Alert: Voting is closed
   */
  votingClosed: (onViewResults?: () => void): VotingAlert => ({
    id: 'voting-closed',
    type: 'info',
    title: 'Голосование завершено',
    message: 'Это голосование уже закрыто. Вы можете посмотреть результаты.',
    dismissable: true,
    actions: onViewResults
      ? [{ label: 'Посмотреть результаты', onClick: onViewResults, primary: true }]
      : undefined,
  }),
  
  /**
   * Alert: Authentication required
   */
  authRequired: (onLogin?: () => void): VotingAlert => ({
    id: 'auth-required',
    type: 'warning',
    title: 'Требуется авторизация',
    message: 'Для участия в голосовании необходимо войти в систему.',
    dismissable: false,
    actions: onLogin
      ? [{ label: 'Войти', onClick: onLogin, primary: true }]
      : undefined,
  }),
  
  /**
   * Alert: Telegram link required
   */
  telegramRequired: (onLinkTelegram?: () => void): VotingAlert => ({
    id: 'telegram-required',
    type: 'warning',
    title: 'Требуется привязка Telegram',
    message: 'Для участия в этом голосовании необходимо привязать Telegram аккаунт.',
    dismissable: true,
    actions: onLinkTelegram
      ? [{ label: 'Привязать Telegram', onClick: onLinkTelegram, primary: true }]
      : undefined,
  }),
  
  /**
   * Alert: Vote submitted successfully
   */
  voteSuccess: (): VotingAlert => ({
    id: 'vote-success',
    type: 'success',
    title: 'Голос принят',
    message: 'Ваш голос успешно учтён.',
    dismissable: true,
    autoDismiss: true,
    autoDismissDelay: 3000,
  }),
  
  /**
   * Alert: Vote revoked successfully
   */
  voteRevoked: (): VotingAlert => ({
    id: 'vote-revoked',
    type: 'info',
    title: 'Голос отозван',
    message: 'Ваш голос успешно отозван. Вы можете проголосовать снова.',
    dismissable: true,
    autoDismiss: true,
    autoDismissDelay: 3000,
  }),
  
  /**
   * Alert: Vote error
   */
  voteError: (errorMessage?: string, onRetry?: () => void): VotingAlert => ({
    id: 'vote-error',
    type: 'error',
    title: 'Ошибка голосования',
    message: errorMessage ?? 'Не удалось отправить голос. Попробуйте ещё раз.',
    dismissable: true,
    actions: onRetry
      ? [{ label: 'Повторить', onClick: onRetry, primary: true }]
      : undefined,
  }),
  
  /**
   * Alert: Rate limit exceeded
   */
  rateLimit: (retryAfter: number): VotingAlert => ({
    id: 'rate-limit',
    type: 'warning',
    title: 'Слишком много запросов',
    message: `Подождите ${retryAfter} секунд перед следующей попыткой.`,
    dismissable: false,
  }),
};

// ============================================================================
// Export
// ============================================================================

export default VotingAlerts;
