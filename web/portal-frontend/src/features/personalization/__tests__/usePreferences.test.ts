/**
 * Tests for usePreferences hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { usePreferences } from '../hooks/usePreferences';
import * as personalizationApi from '../api/personalizationApi';

// Mock the API
vi.mock('../api/personalizationApi', () => ({
  fetchPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  resetPreferences: vi.fn(),
  fetchDefaultPreferences: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const mockPreferences = {
  id: 'test-id',
  user_id: 'user-123',
  tenant_id: 'tenant-456',
  appearance: {
    theme: 'light' as const,
    accent_color: '#007AFF',
    font_size: 'medium' as const,
    high_contrast: false,
    reduce_motion: false,
  },
  localization: {
    language: 'en' as const,
    timezone: 'UTC',
  },
  notifications: {
    email: { enabled: true, digest: 'daily' as const },
    in_app: { enabled: true },
    push: { enabled: false },
    types: {},
    quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
  },
  privacy: {
    profile_visibility: 'members' as const,
    show_online_status: true,
    show_vote_history: false,
    share_activity: true,
    allow_mentions: true,
    analytics_enabled: true,
    recommendations_enabled: true,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('usePreferences', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
    vi.clearAllMocks();
    
    vi.mocked(personalizationApi.fetchPreferences).mockResolvedValue(mockPreferences);
    vi.mocked(personalizationApi.updatePreferences).mockResolvedValue({ ...mockPreferences });
    vi.mocked(personalizationApi.resetPreferences).mockResolvedValue(mockPreferences);
    vi.mocked(personalizationApi.fetchDefaultPreferences).mockResolvedValue({
      appearance: mockPreferences.appearance,
      localization: mockPreferences.localization,
      notifications: mockPreferences.notifications,
      privacy: mockPreferences.privacy,
    });
    window.localStorage.clear();
  });

  it('fetches preferences on mount', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(personalizationApi.fetchPreferences).toHaveBeenCalledTimes(1);
    expect(result.current.preferences).toEqual(mockPreferences);
  });

  it('updates appearance preferences', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    const newAppearance = { theme: 'dark' as const };
    await result.current.updateAppearance(newAppearance);
    
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(vi.mocked(personalizationApi.updatePreferences).mock.calls[0]?.[0]).toEqual({
      appearance: newAppearance,
    });
  });

  it('updates notification preferences', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    const newNotifications = { 
      email: { enabled: false, digest: 'weekly' as const } 
    };
    await result.current.updateNotifications(newNotifications);
    
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(vi.mocked(personalizationApi.updatePreferences).mock.calls[0]?.[0]).toEqual({
      notifications: newNotifications,
    });
  });

  it('resets preferences to defaults', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    await result.current.resetToDefaults();
    
    expect(personalizationApi.resetPreferences).toHaveBeenCalledTimes(1);
  });

  it('handles loading states correctly', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isResetting).toBe(false);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('caches preferences to localStorage', async () => {
    renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => {
      expect(window.localStorage.getItem('personalization-preferences-cache-v1')).not.toBeNull();
    });
  });
});
