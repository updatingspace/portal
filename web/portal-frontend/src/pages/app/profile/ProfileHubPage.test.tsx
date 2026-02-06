import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders, screen } from '../../../test/test-utils';
import { ProfileHubPage } from './ProfileHubPage';
import type { ProfileHubVM } from './model/types';

const mockUseProfileSession = vi.fn();
const mockUseProfileHubData = vi.fn();
const mockCreateNews = vi.fn();

vi.mock('./model/useProfileSession', () => ({
  useProfileSession: () => mockUseProfileSession(),
}));

vi.mock('./model/useProfileHubData', () => ({
  useProfileHubData: (sessionInfo: unknown) => mockUseProfileHubData(sessionInfo),
}));

vi.mock('../../../hooks/useActivity', () => ({
  useCreateNews: () => ({ mutateAsync: mockCreateNews }),
}));

vi.mock('./components/CreatePostComposer', () => ({
  CreatePostComposer: (props: { canCreatePost: boolean }) => (
    <div>
      {!props.canCreatePost && (
        <span>У вас нет прав на публикацию в этом tenant’е. Обратитесь к администратору.</span>
      )}
      <button disabled={!props.canCreatePost}>Опубликовать</button>
    </div>
  ),
}));

const baseVm: ProfileHubVM = {
  viewer: {
    id: 'u-1',
    isSelf: true,
    permissions: {
      canEditProfile: true,
      canCreatePost: true,
      canViewPosts: true,
      canFollow: false,
      canMessage: false,
      canViewProfile: true,
    },
  },
  owner: {
    id: 'u-1',
    tenantDisplayName: 'Test User',
    handle: 'test',
  },
  stats: {
    posts: 0,
    following: 0,
    followers: 0,
    communities: 0,
    achievements: 0,
    friends: 0,
  },
  about: {},
  previews: {
    achievements: [],
    following: [],
    followers: [],
    communities: [],
    friends: [],
  },
  feed: {
    items: [],
    hasMore: false,
  },
  capabilities: {
    canEditProfile: true,
    canCreatePost: true,
    canViewPosts: true,
    canFollow: false,
    canMessage: false,
    canViewProfile: true,
  },
};

describe('ProfileHubPage', () => {
  beforeEach(() => {
    mockUseProfileSession.mockReturnValue({ sessionInfo: { tenant: { id: 't-1', slug: 'aef' }, user: { id: 'u-1' } } });
    mockUseProfileHubData.mockReturnValue({
      vm: baseVm,
      isLoading: false,
      isFeedLoading: false,
      feedError: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetchFeed: vi.fn().mockResolvedValue(undefined),
    });
    mockCreateNews.mockReset();
  });

  it('renders safely with partial data (no avatar/bio/widgets)', () => {
    renderWithProviders(<ProfileHubPage />, {
      route: '/app/profile',
      authUser: {
        id: 'u-1',
        username: 'test',
        email: null,
        displayName: 'Test User',
        isSuperuser: false,
        isStaff: false,
      },
    });

    expect(screen.getByRole('heading', { name: 'Test User' })).toBeInTheDocument();
    expect(screen.getByText('Добавьте описание профиля — так людям проще понять, кто вы.')).toBeInTheDocument();
  });

  it('shows disabled composer hint when post.create is missing', () => {
    mockUseProfileHubData.mockReturnValue({
      vm: {
        ...baseVm,
        capabilities: { ...baseVm.capabilities, canCreatePost: false },
      },
      isLoading: false,
      isFeedLoading: false,
      feedError: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetchFeed: vi.fn(),
    });

    renderWithProviders(<ProfileHubPage />, {
      route: '/app/profile',
      authUser: {
        id: 'u-1',
        username: 'test',
        email: null,
        displayName: 'Test User',
        isSuperuser: false,
        isStaff: false,
      },
    });

    expect(screen.getByText('У вас нет прав на публикацию в этом tenant’е. Обратитесь к администратору.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Опубликовать' }).some((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('renders no-permission block instead of feed when post.view missing', () => {
    mockUseProfileHubData.mockReturnValue({
      vm: {
        ...baseVm,
        capabilities: { ...baseVm.capabilities, canViewPosts: false },
      },
      isLoading: false,
      isFeedLoading: false,
      feedError: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetchFeed: vi.fn(),
    });

    renderWithProviders(<ProfileHubPage />, {
      route: '/app/profile',
      authUser: {
        id: 'u-1',
        username: 'test',
        email: null,
        displayName: 'Test User',
        isSuperuser: false,
        isStaff: false,
      },
    });

    expect(screen.getByText('У вас нет прав на просмотр публикаций в этом разделе.')).toBeInTheDocument();
  });

  it('renders feed loading skeleton and feed error state', () => {
    mockUseProfileHubData.mockReturnValueOnce({
      vm: baseVm,
      isLoading: false,
      isFeedLoading: true,
      feedError: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetchFeed: vi.fn(),
    });

    const { rerender, container } = renderWithProviders(<ProfileHubPage />, {
      route: '/app/profile',
      authUser: {
        id: 'u-1',
        username: 'test',
        email: null,
        displayName: 'Test User',
        isSuperuser: false,
        isStaff: false,
      },
    });

    expect(container.querySelectorAll('.profile-hub__post-skeleton').length).toBeGreaterThan(0);

    mockUseProfileHubData.mockReturnValueOnce({
      vm: baseVm,
      isLoading: false,
      isFeedLoading: false,
      feedError: new Error('boom'),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetchFeed: vi.fn(),
    });

    rerender(<ProfileHubPage />);
    expect(screen.getByText('Не удалось загрузить ленту')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
