/**
 * Feed Components Unit Tests
 *
 * Tests for FeedItem component.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';

import { FeedItem } from './FeedItem';
import { createActivityEvents } from '../../../test/fixtures';
import type { ActivityEvent } from '../../../types/activity';

// Wrapper for Gravity UI components
function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme="light">
      {ui}
    </ThemeProvider>,
  );
}

describe('FeedItem', () => {
  const mockItem: ActivityEvent = createActivityEvents()[0];

  it('renders item title', () => {
    renderWithTheme(<FeedItem item={mockItem} />);

    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
  });

  it('renders event type icon', () => {
    renderWithTheme(<FeedItem item={mockItem} />);

    // Vote cast event should have vote icon
    expect(screen.getByText('🗳️')).toBeInTheDocument();
  });

  it('renders date string', () => {
    renderWithTheme(<FeedItem item={mockItem} />);

    // Date should be formatted
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('renders event type label', () => {
    renderWithTheme(<FeedItem item={mockItem} />);

    expect(screen.getByText(/Голосование/i)).toBeInTheDocument();
  });

  it('renders scope type when present', () => {
    const itemWithScope: ActivityEvent = {
      ...mockItem,
      scopeType: 'COMMUNITY',
    };
    renderWithTheme(<FeedItem item={itemWithScope} />);

    expect(screen.getByText('COMMUNITY')).toBeInTheDocument();
  });

  it('renders payload when showPayload is true', () => {
    renderWithTheme(<FeedItem item={mockItem} showPayload={true} />);

    // Payload JSON should be displayed
    expect(screen.getByText(/"poll_id"/)).toBeInTheDocument();
  });

  it('hides payload when showPayload is false', () => {
    renderWithTheme(<FeedItem item={mockItem} showPayload={false} />);

    expect(screen.queryByText(/"poll_id"/)).not.toBeInTheDocument();
  });

  it('renders compact variant', () => {
    renderWithTheme(<FeedItem item={mockItem} compact={true} />);

    // Should still show title and type
    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
    expect(screen.getByText(/Голосование/i)).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    renderWithTheme(<FeedItem item={mockItem} onClick={handleClick} />);

    // Component is wrapped in a div with role="button" when onClick is provided
    const clickable = screen.getByRole('button');
    expect(clickable).toBeInTheDocument();

    await user.click(clickable);
    expect(handleClick).toHaveBeenCalledWith(mockItem);
  });

  it('renders different event types correctly', () => {
    const achievementItem: ActivityEvent = {
      ...mockItem,
      type: 'game.achievement',
      title: 'Achievement Unlocked',
    };

    renderWithTheme(<FeedItem item={achievementItem} />);

    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText(/Достижение/i)).toBeInTheDocument();
  });

  it('handles unknown event types with fallback', () => {
    const unknownItem: ActivityEvent = {
      ...mockItem,
      type: 'custom.event',
      title: 'Custom Event',
    };

    renderWithTheme(<FeedItem item={unknownItem} />);

    // Should show fallback icon
    expect(screen.getByText('📌')).toBeInTheDocument();
  });
});

