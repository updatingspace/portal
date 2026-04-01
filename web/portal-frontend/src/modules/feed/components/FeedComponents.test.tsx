/**
 * Feed Components Unit Tests
 *
 * Tests for FeedItem component.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FeedItem } from './FeedItem';
import { FeedComposerPanel } from './FeedComposerPanel';
import { FeedStreamView } from './FeedStreamView';
import { createActivityEvents } from '../../../test/fixtures';
import type { ActivityEvent } from '../../../types/activity';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@gravity-ui/markdown-editor', () => ({
  MarkdownEditorView: () => <div data-testid="mock-markdown-editor" />,
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

  it('renders moderation checkbox in moderation mode', () => {
    const onModerationToggle = vi.fn();
    renderWithTheme(
      <FeedItem
        item={{
          ...mockItem,
          type: 'news.posted',
          payloadJson: { news_id: 'news-1', body: 'hello', tags: [] },
        }}
        moderationMode
        onModerationToggle={onModerationToggle}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onModerationToggle).toHaveBeenCalledWith('news-1', true);
  });
});

describe('FeedComposerPanel', () => {
  const baseProps = {
    canCreateNews: true,
    composerOpen: true,
    setComposerOpen: vi.fn(),
    emptyToolbarsPreset: { items: {}, orders: {} },
    editor: { getValue: vi.fn(), on: vi.fn(), off: vi.fn() },
    fileInputRef: { current: null } as React.RefObject<HTMLInputElement>,
    handleImageUpload: vi.fn(),
    detectedTags: [],
    composerError: null,
    newsVisibility: 'public' as const,
    setNewsVisibility: vi.fn(),
    isCreatingNews: false,
    uploading: false,
    composerHasText: true,
    composerHasMedia: true,
    handlePublishNews: vi.fn(),
    handleComposerKeyDown: vi.fn(),
    newsMedia: [],
    handleRemoveMedia: vi.fn(),
  };

  it('shows access-locked state when user cannot create', () => {
    renderWithTheme(<FeedComposerPanel {...baseProps} canCreateNews={false} />);
    expect(screen.getByText('Публикация новостей недоступна.')).toBeInTheDocument();
  });

  it('calls handleComposerKeyDown on key press', () => {
    const onKeyDown = vi.fn();
    renderWithTheme(<FeedComposerPanel {...baseProps} handleComposerKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByLabelText('Композер новостей'), { key: 'Enter', ctrlKey: true });
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('disables publish button when composer has no media', () => {
    renderWithTheme(<FeedComposerPanel {...baseProps} composerHasMedia={false} />);
    expect(screen.getByRole('button', { name: 'Опубликовать новость' })).toBeDisabled();
  });

  it('invokes publish action when publish button clicked', () => {
    const handlePublishNews = vi.fn();
    renderWithTheme(<FeedComposerPanel {...baseProps} handlePublishNews={handlePublishNews} />);
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать новость' }));
    expect(handlePublishNews).toHaveBeenCalledTimes(1);
  });
});

describe('FeedStreamView', () => {
  const baseEvent: ActivityEvent = {
    ...createActivityEvents()[0],
    type: 'news.posted',
    payloadJson: { news_id: 'news-1', body: 'sample body', tags: [] },
  };

  const baseProps = {
    unreadCount: 0,
    refetch: vi.fn(),
    isMarkingRead: false,
    markAsRead: vi.fn(),
    canModerateNews: true,
    moderationMode: false,
    toggleModerationMode: vi.fn(),
    selectedModerationCount: 0,
    moderationReason: '',
    setModerationReason: vi.fn(),
    moderationError: null,
    clearModerationSelection: vi.fn(),
    handleModerationDeleteSelected: vi.fn(),
    hasContent: true,
    isLoading: false,
    source: 'all' as const,
    sortedItems: [baseEvent],
    selectedModerationIds: [],
    getItemNewsId: () => 'news-1',
    handleModerationToggle: vi.fn(),
    loadMoreRef: { current: null } as React.RefObject<HTMLDivElement>,
    isFetchingNextPage: false,
    hasNextPage: true,
  };

  it('renders updated unread copy', () => {
    renderWithTheme(<FeedStreamView {...baseProps} unreadCount={3} />);
    expect(screen.getByText('Новых событий: 3')).toBeInTheDocument();
    expect(screen.getByText('Обновите ленту или отметьте события прочитанными.')).toBeInTheDocument();
  });

  it('renders updated empty copy for filtered state', () => {
    renderWithTheme(
      <FeedStreamView
        {...baseProps}
        hasContent={false}
        isLoading={false}
        source="events"
        sortedItems={[]}
      />,
    );
    expect(screen.getByText('Нет событий под выбранные фильтры.')).toBeInTheDocument();
    expect(screen.getByText('Попробуйте сменить фильтры или зайдите позже.')).toBeInTheDocument();
  });

  it('shows moderation controls with accessibility label', () => {
    renderWithTheme(<FeedStreamView {...baseProps} moderationMode={true} />);
    expect(screen.getByRole('button', { name: 'Переключить режим модерации' })).toBeInTheDocument();
    expect(screen.getByText('Горячая клавиша: Alt + M')).toBeInTheDocument();
  });
});
