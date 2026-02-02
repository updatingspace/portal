import React from 'react';
import { Card, Label, Text } from '@gravity-ui/uikit';
import type { Poll } from '../types';
import {
  POLL_STATUS_META,
  RESULTS_VISIBILITY_META,
  VISIBILITY_META,
  formatDateTime,
  getScheduleMeta,
} from '../utils/pollMeta';

export interface PollCardProps {
  poll: Poll;
  actions?: React.ReactNode;
  locale?: string | null;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, actions, locale }) => {
  const statusMeta = POLL_STATUS_META[poll.status];
  const visibilityMeta = VISIBILITY_META[poll.visibility];
  const resultsMeta = RESULTS_VISIBILITY_META[poll.results_visibility];
  const scheduleMeta = getScheduleMeta(poll.starts_at, poll.ends_at);
  const scheduleLabel = scheduleMeta ? formatDateTime(scheduleMeta.at, locale) : null;

  return (
    <Card className="h-full border border-slate-200/70 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label theme={statusMeta.theme} size="xs" title={statusMeta.description}>
              {statusMeta.label}
            </Label>
            <Label theme={visibilityMeta.theme} size="xs" title={visibilityMeta.description}>
              {visibilityMeta.label}
            </Label>
            <Label theme={resultsMeta.theme} size="xs" title={resultsMeta.description}>
              {resultsMeta.label}
            </Label>
            {poll.anonymous && (
              <Label theme="utility" size="xs">
                Анонимно
              </Label>
            )}
            {poll.allow_revoting && (
              <Label theme="info" size="xs">
                Переголосование
              </Label>
            )}
          </div>

          <div>
            <Text variant="subheader-2" className="text-slate-900">
              {poll.title}
            </Text>
            {poll.description && (
              <Text variant="body-2" color="secondary" className="mt-1 line-clamp-2">
                {poll.description}
              </Text>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            {scheduleLabel && (
              <span>
                {scheduleMeta?.label}: {scheduleLabel}
              </span>
            )}
            <span>Создан: {formatDateTime(poll.created_at, locale) ?? '—'}</span>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Card>
  );
};
