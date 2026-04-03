import { describe, expect, it } from 'vitest';

import { getUniqueEventTypes, groupFeedByDate } from './useActivity';

describe('useActivity pure utilities', () => {
  it('returns sorted unique event types', () => {
    const types = getUniqueEventTypes([
      { type: 'vote.cast' },
      { type: 'event.created' },
      { type: 'vote.cast' },
    ] as never);

    expect(types).toEqual(['event.created', 'vote.cast']);
  });

  it('groups events by localized date with fallback for invalid date', () => {
    const groups = groupFeedByDate([
      { occurredAt: '2026-01-01T12:00:00Z', type: 'vote.cast' },
      { occurredAt: 'invalid-date', type: 'event.created' },
    ] as never);

    expect(groups.get('Без даты')).toHaveLength(1);
    expect(Array.from(groups.values()).flat()).toHaveLength(2);
  });
});
