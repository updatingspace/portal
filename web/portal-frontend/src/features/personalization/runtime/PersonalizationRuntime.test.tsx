import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeMode } from '../../../app/providers/themeModeContext';
import { act, renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import * as personalizationApi from '../api/personalizationApi';
import {
  PERSONALIZATION_PREFERENCES_CACHE_KEY,
  PERSONALIZATION_PREFERENCES_UPDATED_EVENT,
} from '../hooks/usePreferences';
import { PersonalizationRuntime } from './PersonalizationRuntime';

vi.mock('../api/personalizationApi', () => ({
  fetchPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  resetPreferences: vi.fn(),
  fetchDefaultPreferences: vi.fn(),
}));

const authUser = {
  id: 'user-1',
  username: 'member',
  email: 'member@example.com',
  displayName: 'Portal Member',
  isSuperuser: false,
  isStaff: false,
};

const ThemeProbe = () => {
  const { mode, resolvedMode } = useThemeMode();
  return <div data-testid="theme-probe">{`${mode}/${resolvedMode}`}</div>;
};

const darkPreferences = {
  id: 'pref-1',
  user_id: 'user-1',
  tenant_id: 'tenant-1',
  created_at: '2026-04-05T12:00:00Z',
  updated_at: '2026-04-05T12:00:00Z',
  appearance: {
    theme: 'dark' as const,
    theme_source: 'portal' as const,
    accent_color: '#0F766E',
    font_size: 'large' as const,
    high_contrast: true,
    reduce_motion: true,
  },
  localization: {
    language: 'ru' as const,
    timezone: 'Europe/Moscow',
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
};

const autoPreferences = {
  ...darkPreferences,
  appearance: {
    ...darkPreferences.appearance,
    theme: 'auto' as const,
    accent_color: '#0EA5E9',
    font_size: 'medium' as const,
    high_contrast: false,
    reduce_motion: false,
  },
};

describe('PersonalizationRuntime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(personalizationApi.fetchPreferences).mockResolvedValue(darkPreferences);
    vi.mocked(personalizationApi.fetchDefaultPreferences).mockResolvedValue({
      appearance: darkPreferences.appearance,
      localization: darkPreferences.localization,
      notifications: darkPreferences.notifications,
      privacy: darkPreferences.privacy,
    });
    document.documentElement.style.removeProperty('--user-accent-color');
    document.documentElement.style.removeProperty('--user-font-size');
    document.documentElement.dataset.highContrast = 'false';
    document.documentElement.dataset.reduceMotion = 'false';
    document.body.classList.remove('reduce-motion');
  });

  it('applies cached personalization preferences to the shell runtime', async () => {
    window.localStorage.setItem(
      PERSONALIZATION_PREFERENCES_CACHE_KEY,
      JSON.stringify(darkPreferences),
    );

    renderWithProviders(
      <>
        <PersonalizationRuntime />
        <ThemeProbe />
      </>,
      { authUser },
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark/dark');
      expect(document.documentElement.style.getPropertyValue('--user-accent-color')).toBe('#0F766E');
      expect(document.documentElement.style.getPropertyValue('--user-font-size')).toBe('16px');
      expect(document.documentElement.dataset.highContrast).toBe('true');
      expect(document.documentElement.dataset.reduceMotion).toBe('true');
      expect(document.body.classList.contains('reduce-motion')).toBe(true);
    });
  });

  it('reacts to cached preference updates without a route reload', async () => {
    vi.mocked(personalizationApi.fetchPreferences).mockResolvedValue(autoPreferences);
    window.localStorage.setItem(
      PERSONALIZATION_PREFERENCES_CACHE_KEY,
      JSON.stringify(autoPreferences),
    );

    renderWithProviders(
      <>
        <PersonalizationRuntime />
        <ThemeProbe />
      </>,
      { authUser },
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-probe')).toHaveTextContent(/^auto\//);
    });

    const nextPreferences = {
      ...autoPreferences,
      appearance: {
        ...autoPreferences.appearance,
        theme: 'auto' as const,
        theme_source: 'portal' as const,
        accent_color: '#D97706',
        font_size: 'small' as const,
        high_contrast: false,
        reduce_motion: false,
      },
      updated_at: '2026-04-05T12:05:00Z',
    };

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(PERSONALIZATION_PREFERENCES_UPDATED_EVENT, {
          detail: nextPreferences,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('theme-probe')).toHaveTextContent(/^auto\//);
      expect(document.documentElement.style.getPropertyValue('--user-accent-color')).toBe('#D97706');
      expect(document.documentElement.style.getPropertyValue('--user-font-size')).toBe('14px');
      expect(document.documentElement.dataset.highContrast).toBe('false');
      expect(document.documentElement.dataset.reduceMotion).toBe('false');
      expect(document.body.classList.contains('reduce-motion')).toBe(false);
    });
  });
});
