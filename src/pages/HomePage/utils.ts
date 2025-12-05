import type { VoteStatus } from './types';

export const parseDeadline = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDeadline = (deadline: Date | null) => {
  if (!deadline) return 'Дедлайн не назначен';
  return deadline.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const formatTimeLeft = (deadline: Date | null, status: VoteStatus, nowTs: number) => {
  if (!deadline) {
    return status === 'expired' ? 'Завершенно принудительно' : 'Дедлайн уточняется';
  }

  const diffMs = deadline.getTime() - nowTs;

  if (status === 'expired' || diffMs <= 0) {
    return `Завершено: ${deadline.toLocaleDateString('ru-RU', { dateStyle: 'medium' })}`;
  }

  const minutesTotal = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(minutesTotal / (60 * 24));
  const hours = Math.floor((minutesTotal - days * 24 * 60) / 60);

  if (days > 0) {
    return `Осталось ≈ ${days}д ${hours}ч`;
  }

  const restHours = Math.floor(minutesTotal / 60);
  if (restHours > 0) {
    return `Осталось ≈ ${restHours}ч`;
  }

  const restMinutes = Math.max(1, minutesTotal);
  return `Осталось минут: ${restMinutes}`;
};
