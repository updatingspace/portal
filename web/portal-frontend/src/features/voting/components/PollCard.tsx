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
    <Card className="voting-v2__card">
      <div className="voting-v2__grid">
        <div className="voting-v2__pills">
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
            <Text variant="subheader-2">
              {poll.title}
            </Text>
            {poll.description && (
              <Text variant="body-2" color="secondary">
                {poll.description}
              </Text>
            )}
          </div>

          <div className="voting-v2__toolbar-left voting-v2__small voting-v2__muted">
            {scheduleLabel && (
              <span>
                {scheduleMeta?.label}: {scheduleLabel}
              </span>
            )}
            <span>Создан: {formatDateTime(poll.created_at, locale) ?? '—'}</span>
          </div>

        {actions ? <div className="voting-v2__toolbar-left">{actions}</div> : null}
      </div>
    </Card>
  );
};
