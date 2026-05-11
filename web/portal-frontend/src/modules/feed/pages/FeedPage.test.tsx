import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@gravity-ui/uikit';

import { FeedPage } from './FeedPage';

const navigateMock = vi.fn();
const controllerMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../api/accessDenied', () => ({
  createClientAccessDeniedError: vi.fn(() => ({ code: 'FORBIDDEN' })),
  toAccessDeniedError: vi.fn(() => null),
}));

vi.mock('../../../api/client', () => ({
  isApiError: vi.fn(() => false),
}));

vi.mock('../../../features/access-denied', () => ({
  AccessDeniedScreen: () => <div>access denied</div>,
}));

vi.mock('../hooks/useFeedPageController', () => ({
  useFeedPageController: () => controllerMock(),
}));

vi.mock('../components/FeedComposerPanel', () => ({
  FeedComposerPanel: () => <div data-qa="mock-composer">composer</div>,
}));

vi.mock('../components/FeedControlRail', () => ({
  FeedControlRail: () => <aside data-qa="mock-rail">rail</aside>,
}));

vi.mock('../components/FeedStreamView', () => ({
  FeedStreamView: () => <section data-qa="mock-stream">stream</section>,
}));

vi.mock('../components/FeedItem', () => ({
  FeedItem: ({ item }: { item: { title: string } }) => <article data-qa="mock-feed-item">{item.title}</article>,
}));

const baseController = {
  canReadFeed: true,
  isPermalinkView: false,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  user: { tenant: { id: 't1', slug: 'aef' } },
  focusedNews: null,
  focusedNewsId: null,
  canCreateNews: true,
  composerOpen: false,
  setComposerOpen: vi.fn(),
  composerValue: '',
  setComposerValue: vi.fn(),
  fileInputRef: { current: null },
  handleImageUpload: vi.fn(),
  detectedTags: [],
  publishMode: 'public' as const,
  setPublishMode: vi.fn(),
  isCreatingNews: false,
  uploading: false,
  canPublishNews: false,
  handlePublishNews: vi.fn(),
  handleComposerKeyDown: vi.fn(),
  newsMedia: [],
  handleRemoveMedia: vi.fn(),
  unreadCount: 0,
  isMarkingRead: false,
  markAsRead: vi.fn(),
  canModerateNews: false,
  moderationMode: false,
  toggleModerationMode: vi.fn(),
  selectedModerationIds: [],
  selectedModerationCount: 0,
  moderationReason: '',
  setModerationReason: vi.fn(),
  moderationError: null,
  setSelectedModerationIds: vi.fn(),
  clearModerationSelection: vi.fn(),
  handleModerationDeleteSelected: vi.fn(),
  hasContent: false,
  source: 'all' as const,
  sortedItems: [],
  draftItems: [],
  getItemNewsId: vi.fn(() => null),
  handleModerationToggle: vi.fn(),
  loadMoreRef: { current: null },
  isFetchingNextPage: false,
  hasNextPage: false,
  realtimeFlagEnabled: false,
  period: 'week' as const,
  sort: 'best' as const,
  setSource: vi.fn(),
  setPeriod: vi.fn(),
  setSort: vi.fn(),
  resetFilters: vi.fn(),
};

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders single-post layout for permalink route without composer or rail', () => {
    controllerMock.mockReturnValue({
      ...baseController,
      isPermalinkView: true,
      focusedNewsId: 'news-1',
      focusedNews: {
        id: 1,
        title: 'Focused Post',
      },
    });

    render(
      <ThemeProvider theme="light">
        <FeedPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('К ленте')).toBeInTheDocument();
    expect(screen.getByText('Focused Post')).toBeInTheDocument();
    expect(screen.queryByText('stream')).not.toBeInTheDocument();
    expect(screen.queryByText('composer')).not.toBeInTheDocument();
    expect(screen.queryByText('rail')).not.toBeInTheDocument();
  });

  it('renders full feed shell outside permalink route', () => {
    controllerMock.mockReturnValue(baseController);

    render(
      <ThemeProvider theme="light">
        <FeedPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('stream')).toBeInTheDocument();
    expect(screen.getByText('rail')).toBeInTheDocument();
  });
});
