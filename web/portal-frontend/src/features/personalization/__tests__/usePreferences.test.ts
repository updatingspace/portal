/**
 * Tests for usePreferences hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { usePreferences } from '../hooks/usePreferences';

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
  
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
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
    
    // Setup default mocks
    const { fetchPreferences, updatePreferences, resetPreferences, fetchDefaultPreferences } = 
      require('../api/personalizationApi');
    
    fetchPreferences.mockResolvedValue(mockPreferences);
    updatePreferences.mockResolvedValue({ ...mockPreferences });
    resetPreferences.mockResolvedValue(mockPreferences);
    fetchDefaultPreferences.mockResolvedValue({
      appearance: mockPreferences.appearance,
      localization: mockPreferences.localization,
      notifications: mockPreferences.notifications,
      privacy: mockPreferences.privacy,
    });
  });

  it('fetches preferences on mount', async () => {
    const { fetchPreferences } = require('../api/personalizationApi');
    
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(fetchPreferences).toHaveBeenCalledTimes(1);
    expect(result.current.preferences).toEqual(mockPreferences);
  });

  it('updates appearance preferences', async () => {
    const { updatePreferences } = require('../api/personalizationApi');
    
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    const newAppearance = { theme: 'dark' as const };
    await result.current.updateAppearance(newAppearance);
    
    expect(updatePreferences).toHaveBeenCalledWith({
      appearance: newAppearance,
    });
  });

  it('updates notification preferences', async () => {
    const { updatePreferences } = require('../api/personalizationApi');
    
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    const newNotifications = { 
      email: { enabled: false, digest: 'weekly' as const } 
    };
    await result.current.updateNotifications(newNotifications);
    
    expect(updatePreferences).toHaveBeenCalledWith({
      notifications: newNotifications,
    });
  });

  it('resets preferences to defaults', async () => {
    const { resetPreferences } = require('../api/personalizationApi');
    
    const { result } = renderHook(() => usePreferences(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    await result.current.resetToDefaults();
    
    expect(resetPreferences).toHaveBeenCalledTimes(1);
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
});