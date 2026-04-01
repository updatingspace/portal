/**
 * Feed Components Unit Tests
 *
 * Tests for FeedItem component.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FeedItem } from './FeedItem';
import { createActivityEvents } from '../../../test/fixtures';
import type { ActivityEvent } from '../../../types/activity';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

// Wrapper for Gravity UI components
function renderWithTheme(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme="light">
        {ui}
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function renderFeedItem(props: Partial<React.ComponentProps<typeof FeedItem>> = {}) {
  const mockItem: ActivityEvent = createActivityEvents()[0];
  const item = props.item ?? mockItem;

  return renderWithTheme(
    <FeedItem
      item={item}
      showPayload={props.showPayload}
      compact={props.compact}
    />,
  );
}

describe('FeedItem', () => {
  const mockItem: ActivityEvent = createActivityEvents()[0];
  const EVENT_TYPE_CASES = [
    {
      title: 'achievement',
      type: 'game.achievement',
      eventTitle: 'Achievement Unlocked',
      expectedIcon: '🏆',
    },
    {
      title: 'unknown',
      type: 'custom.event',
      eventTitle: 'Custom Event',
      expectedIcon: '📌',
    },
  ] as const;

  it('should render item title', () => {
    renderFeedItem({ item: mockItem });

    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
  });

  it('should render event type icon', () => {
    renderFeedItem({ item: mockItem });

    expect(screen.getByText('🗳️')).toBeInTheDocument();
  });

  it('should render formatted date string', () => {
    renderFeedItem({ item: mockItem });

    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('should render event type label', () => {
    renderFeedItem({ item: mockItem });

    expect(screen.getByText(/Голосование/i)).toBeInTheDocument();
  });

  it('should render scope type when it exists', () => {
    const itemWithScope: ActivityEvent = {
      ...mockItem,
      scopeType: 'COMMUNITY',
    };
    renderFeedItem({ item: itemWithScope });

    expect(screen.getByText('COMMUNITY')).toBeInTheDocument();
  });

  it('should render payload when showPayload is true', () => {
    renderFeedItem({ item: mockItem, showPayload: true });

    expect(screen.getByText(/"poll_id"/)).toBeInTheDocument();
  });

  it('should hide payload when showPayload is false', () => {
    renderFeedItem({ item: mockItem, showPayload: false });

    expect(screen.queryByText(/"poll_id"/)).not.toBeInTheDocument();
  });

  it('should render title in compact mode', () => {
    renderFeedItem({ item: mockItem, compact: true });

    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
  });

  it('should render event type label in compact mode', () => {
    renderFeedItem({ item: mockItem, compact: true });

    expect(screen.getByText(/Голосование/i)).toBeInTheDocument();
  });

  it('should render achievement label for achievement events', () => {
    const achievementItem: ActivityEvent = {
      ...mockItem,
      type: 'game.achievement',
      title: 'Achievement Unlocked',
    };

    renderFeedItem({ item: achievementItem });

    expect(screen.getByText(/Достижение/i)).toBeInTheDocument();
  });

  it.each(EVENT_TYPE_CASES)('should render expected icon for $title event type', ({
    type,
    eventTitle,
    expectedIcon,
  }) => {
    const item: ActivityEvent = {
      ...mockItem,
      type,
      title: eventTitle,
    };

    renderFeedItem({ item });

    expect(screen.getByText(expectedIcon)).toBeInTheDocument();
  });
});
