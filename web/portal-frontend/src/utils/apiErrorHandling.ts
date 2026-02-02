import type { ToastProps } from '@gravity-ui/uikit';
import type { ApiErrorKind } from '../api/client';
import { isApiError } from '../api/client';
import { toaster } from '../toaster';
import { logger, type LogLevel } from './logger';

type ErrorMeta = {
  title: string;
  description: string;
  theme: ToastProps['theme'];
  kind: ApiErrorKind;
};

const ERROR_META: Record<ApiErrorKind, ErrorMeta> = {
  network: {
    kind: 'network',
    title: 'Нет связи с API',
    description: 'Проверьте, запущен ли бэкенд и доступна ли сеть.',
    theme: 'danger',
  },
  unauthorized: {
    kind: 'unauthorized',
    title: 'Нужна авторизация',
    description: 'Войдите или зарегистрируйтесь во вкладке «Профиль», чтобы продолжить.',
    theme: 'warning',
  },
  forbidden: {
    kind: 'forbidden',
    title: 'Доступ запрещен',
    description: 'Похоже, у аккаунта нет прав для этой операции.',
    theme: 'warning',
  },
  not_found: {
    kind: 'not_found',
    title: 'Не найдено',
    description: 'Запрошенный ресурс отсутствует или удален.',
    theme: 'warning',
  },
  server: {
    kind: 'server',
    title: 'Сервис недоступен',
    description: 'API вернуло ошибку. Попробуйте позже или свяжитесь с поддержкой.',
    theme: 'danger',
  },
  unknown: {
    kind: 'unknown',
    title: 'Неизвестная ошибка',
    description: 'Что-то пошло не так. Попробуйте еще раз.',
    theme: 'danger',
  },
};

const ERROR_LOG_LEVEL: Record<ApiErrorKind, LogLevel> = {
  network: 'error',
  unauthorized: 'warn',
  forbidden: 'warn',
  not_found: 'info',
  server: 'critical',
  unknown: 'error',
};

const resolveKind = (error: unknown): ApiErrorKind => {
  if (isApiError(error)) return error.kind;
  return 'unknown';
};

export const getApiErrorMeta = (error: unknown): ErrorMeta => {
  const kind = resolveKind(error);
  return ERROR_META[kind] ?? ERROR_META.unknown;
};

export const notifyApiError = (error: unknown, context: string) => {
  const { kind, title, description, theme } = getApiErrorMeta(error);
  const serverMessage = isApiError(error) ? error.message?.trim() : null;
  const requestId = isApiError(error) ? error.requestId?.trim() : null;
  const errorCode = isApiError(error) ? error.code?.trim() : null;

  const baseContent = context ? `${context}. ${description}` : description;
  const content =
    serverMessage && !baseContent.includes(serverMessage)
      ? `${baseContent} ${serverMessage}`
      : baseContent;

  const logLevel = ERROR_LOG_LEVEL[kind] ?? 'error';
  logger[logLevel]('API error', {
    area: 'api',
    event: 'request_failed',
    data: {
      kind,
      context,
      title,
      description,
      request_id: requestId ?? undefined,
      code: errorCode ?? undefined,
    },
    error,
  });

  const supportHint = requestId ? `\nRequest ID: ${requestId}` : '';
  const contentWithRequestId = `${content}${supportHint}`;

  toaster.add({
    name: `${kind}-${Date.now()}`,
    title,
    content: contentWithRequestId,
    theme,
    autoHiding: 5000,
  });

  return kind;
};

export const isAuthIssue = (error: unknown) => {
  if (!isApiError(error)) return false;
  return error.kind === 'unauthorized' || error.kind === 'forbidden';
};
