/**
 * Tests for OIDC authentication flow via BFF.
 * Tests the redirectToLogin function and auth module behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env before importing auth module
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_LOGIN_PATH: '/api/v1/auth/login',
      VITE_ID_LOGIN_URL: 'https://id.updspace.com',
    },
  },
});

describe('Auth module', () => {
  let originalLocation: Location;
  let mockAssign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalLocation = window.location;
    mockAssign = vi.fn();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        assign: mockAssign,
        pathname: '/current-page',
        search: '?foo=bar',
        origin: 'http://localhost:5173',
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe('redirectToLogin', () => {
    it('should redirect to /api/v1/auth/login with next param', async () => {
      // Dynamic import to get fresh module with mocked env
      const { redirectToLogin } = await import('./auth');

      redirectToLogin('/dashboard');

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = mockAssign.mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/auth/login');
      expect(calledUrl).toContain('next=%2Fdashboard');
    });

    it('should use current path as next when not specified', async () => {
      const { redirectToLogin } = await import('./auth');

      redirectToLogin();

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = mockAssign.mock.calls[0][0];
      expect(calledUrl).toContain('next=%2Fcurrent-page%3Ffoo%3Dbar');
    });

    it('should build correct URL for relative login path', async () => {
      const { LOGIN_PATH } = await import('./auth');

      // Default LOGIN_PATH should be /api/v1/auth/login
      expect(LOGIN_PATH).toBe('/api/v1/auth/login');
    });
  });

  describe('buildLoginUrl', () => {
    it('should construct URL with next parameter', async () => {
      const { redirectToLogin } = await import('./auth');

      redirectToLogin('/app');

      const calledUrl = mockAssign.mock.calls[0][0];
      const url = new URL(calledUrl);

      expect(url.pathname).toBe('/api/v1/auth/login');
      expect(url.searchParams.get('next')).toBe('/app');
    });
  });
});

describe('Auth flow integration', () => {
  it('LOGIN_PATH constant should point to BFF auth endpoint', async () => {
    const { LOGIN_PATH } = await import('./auth');
    expect(LOGIN_PATH).toMatch(/\/api\/v1\/auth\/login/);
  });

  it('ID_LOGIN_URL should have fallback to id.updspace.com', async () => {
    const { ID_LOGIN_URL } = await import('./auth');
    expect(ID_LOGIN_URL).toContain('id.updspace');
  });
});
