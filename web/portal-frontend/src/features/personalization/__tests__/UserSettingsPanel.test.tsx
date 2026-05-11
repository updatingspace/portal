/**
 * Tests for UserSettingsPanel component
 */
import { fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithProviders, screen } from '@/test/test-utils';
import { UserSettingsPanel } from '../components/UserSettingsPanel';

// Mock the personalization API
vi.mock('../api/personalizationApi', () => ({
  fetchPreferences: vi.fn().mockResolvedValue({
    id: 'test-id',
    user_id: 'user-123',
    tenant_id: 'tenant-456',
    appearance: {
      theme: 'light',
      theme_source: 'portal',
      accent_color: '#007AFF',
      font_size: 'medium',
      high_contrast: false,
      reduce_motion: false,
    },
    localization: {
      language: 'en',
      timezone: 'UTC',
    },
    notifications: {
      email: { enabled: true, digest: 'daily' },
      in_app: { enabled: true },
      push: { enabled: false },
      types: {},
      quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
    },
    privacy: {
      profile_visibility: 'members',
      show_online_status: true,
      show_vote_history: false,
      share_activity: true,
      allow_mentions: true,
      analytics_enabled: true,
      recommendations_enabled: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updatePreferences: vi.fn().mockResolvedValue({}),
  resetPreferences: vi.fn().mockResolvedValue({}),
  fetchDefaultPreferences: vi.fn().mockResolvedValue({}),
}));

// Mock CSS imports
vi.mock('../components/settings/settings.css', () => ({}));

const authUser = {
  id: 'user-1',
  username: 'member',
  email: 'member@example.com',
  displayName: 'Portal Member',
  isSuperuser: false,
  isStaff: false,
  idTheme: 'dark' as const,
};

describe('UserSettingsPanel', () => {
  beforeEach(() => {
    window.localStorage.setItem('portal_locale_v1', 'en');
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    renderWithProviders(<UserSettingsPanel />, { authUser });
    
    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
  });

  it('renders tabs after loading', async () => {
    renderWithProviders(<UserSettingsPanel />, { authUser });
    
    // Wait for preferences to load
    await screen.findByText('Personalization');
    
    // Check tabs are present
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    renderWithProviders(<UserSettingsPanel />, { authUser });
    
    // Wait for loading
    await screen.findByText('Personalization');
    
    // Click on Notifications tab
    fireEvent.click(screen.getByText('Notifications'));
    
    // Should show notifications settings
    expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
    
    // Click on Privacy tab
    fireEvent.click(screen.getByText('Privacy'));
    
    // Should show privacy settings
    expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
  });

  it('shows save status correctly', async () => {
    renderWithProviders(<UserSettingsPanel />, { authUser });
    
    // Wait for loading
    await screen.findByText('Personalization');
    
    // Initial state should not show unsaved changes
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('displays reset button', async () => {
    renderWithProviders(<UserSettingsPanel />, { authUser });
    
    // Wait for loading
    await screen.findByText('Personalization');
    
    // Check reset button is present
    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('renders russian translations when locale is ru', async () => {
    window.localStorage.setItem('portal_locale_v1', 'ru');
    renderWithProviders(<UserSettingsPanel />, { authUser });

    await screen.findByText('Персонализация');
    expect(screen.getByText('Внешний вид')).toBeInTheDocument();
    expect(screen.getByText('Уведомления')).toBeInTheDocument();
    expect(screen.getByText('Приватность')).toBeInTheDocument();
  });
});
