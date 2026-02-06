import React, { useCallback, useMemo } from 'react';
import { Button } from '@gravity-ui/uikit';

import { profileHubStrings } from '../strings/ru';

export type FeedSegment = 'posts' | 'activity' | 'media' | 'pinned';

type FeedFiltersProps = {
  segments: FeedSegment[];
  active: FeedSegment;
  onChange: (segment: FeedSegment) => void;
};

const SEGMENT_LABELS: Record<FeedSegment, string> = {
  posts: profileHubStrings.filters.posts,
  activity: profileHubStrings.filters.activity,
  media: profileHubStrings.filters.media,
  pinned: profileHubStrings.filters.pinned,
};

export const FeedFilters: React.FC<FeedFiltersProps> = ({
  segments,
  active,
  onChange,
}) => {
  const safeActive = useMemo(
    () => (segments.includes(active) ? active : segments[0] ?? 'posts'),
    [active, segments],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (segments.length < 2) return;
      const currentIndex = segments.indexOf(safeActive);
      if (currentIndex < 0) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = segments[(currentIndex + 1) % segments.length];
        onChange(next);
        requestAnimationFrame(() => {
          const nextNode = event.currentTarget.querySelector<HTMLButtonElement>(
            `[role="radio"][data-segment="${next}"]`,
          );
          nextNode?.focus();
        });
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const next = segments[(currentIndex - 1 + segments.length) % segments.length];
        onChange(next);
        requestAnimationFrame(() => {
          const nextNode = event.currentTarget.querySelector<HTMLButtonElement>(
            `[role="radio"][data-segment="${next}"]`,
          );
          nextNode?.focus();
        });
      }
    },
    [onChange, safeActive, segments],
  );

  return (
    <div className="profile-hub__filters" role="radiogroup" aria-label="Фильтры ленты" onKeyDown={handleKeyDown}>
      {segments.map((segment) => (
        <Button
          key={segment}
          role="radio"
          data-segment={segment}
          size="m"
          view={segment === safeActive ? 'action' : 'outlined'}
          aria-checked={segment === safeActive}
          tabIndex={segment === safeActive ? 0 : -1}
          onClick={() => onChange(segment)}
        >
          {SEGMENT_LABELS[segment]}
        </Button>
      ))}
    </div>
  );
};
