export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

type LogContext = {
  area?: string;
  event?: string;
  action?: string;
  data?: Record<string, unknown>;
  error?: unknown;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  critical: 50,
};

const normalizeLevel = (value?: string): LogLevel => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'debug') return 'debug';
  if (normalized === 'warn' || normalized === 'warning') return 'warn';
  if (normalized === 'error') return 'error';
  if (normalized === 'critical') return 'critical';
  return 'info';
};

const defaultLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
const envLogLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
const currentLevel: LogLevel = envLogLevel
  ? normalizeLevel(envLogLevel)
  : defaultLevel;

const shouldLog = (level: LogLevel) => LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];

const serializeError = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === 'string') {
    return { message: value };
  }
  return { message: String(value) };
};

const emit = (level: LogLevel, message: string, context: LogContext = {}) => {
  if (!shouldLog(level)) return;

  const { error, ...rest } = context;
  const payload =
    error !== undefined
      ? {
          ...rest,
          error: serializeError(error),
        }
      : rest;

  const args: unknown[] = [`[${level.toUpperCase()}] ${message}`];
  if (Object.keys(payload).length) {
    args.push(payload);
  }

  if (level === 'warn') {
    console.warn(...args);
  } else if (level === 'error' || level === 'critical') {
    console.error(...args);
  } else if (level === 'debug') {
    console.debug(...args);
  } else {
    console.info(...args);
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
  critical: (message: string, context?: LogContext) => emit('critical', message, context),
};

export type Logger = typeof logger;
