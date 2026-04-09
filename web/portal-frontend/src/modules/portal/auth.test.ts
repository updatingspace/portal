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

  const loadAuthModule = () => import('./auth');
  const getAssignedUrl = () => String(mockAssign.mock.calls[0][0]);
  const setMockLocation = (overrides: Partial<Location> = {}) => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        assign: mockAssign,
        pathname: '/current-page',
        search: '?foo=bar',
        origin: 'http://localhost:5173',
        protocol: 'http:',
        host: 'localhost:5173',
        ...overrides,
      },
      writable: true,
    });
  };

  beforeEach(() => {
    originalLocation = window.location;
    mockAssign = vi.fn();
    setMockLocation();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe('redirectToLogin', () => {
    it('should call location.assign when redirecting to login', async () => {
      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin('/dashboard');

      expect(mockAssign).toHaveBeenCalledTimes(1);
    });

    it('should include login path in assigned URL', async () => {
      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin('/dashboard');

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = getAssignedUrl();
      expect(calledUrl).toContain('/api/v1/auth/login');
    });

    it('should include encoded explicit next path in assigned URL', async () => {
      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin('/dashboard');

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = getAssignedUrl();
      expect(calledUrl).toContain('next=%2Fdashboard');
    });

    it('should use current path as next when not specified', async () => {
      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin();

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = getAssignedUrl();
      expect(calledUrl).toContain('next=%2Fcurrent-page%3Ffoo%3Dbar');
    });

    it('should expose default relative login path constant', async () => {
      const { LOGIN_PATH } = await loadAuthModule();
      expect(LOGIN_PATH).toBe('/api/v1/auth/login');
    });
  });

  describe('buildLoginUrl', () => {
    it('should construct URL with provided next parameter', async () => {
      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin('/app');

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const calledUrl = getAssignedUrl();
      const url = new URL(calledUrl);

      expect(url.pathname).toBe('/api/v1/auth/login');
      expect(url.searchParams.get('next')).toBe('/app');
    });

    it('uses portal-host auth endpoint for tenant alias hosts', async () => {
      setMockLocation({
        pathname: '/login',
        search: '',
        origin: 'http://aef.localhost:5173',
        host: 'aef.localhost:5173',
      });

      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin('/app/events/42?tab=details');

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const url = new URL(getAssignedUrl());
      expect(url.origin).toBe('http://portal.localhost:5173');
      expect(url.pathname).toBe('/api/v1/auth/login');
      expect(url.searchParams.get('next')).toBe('/t/aef/events/42?tab=details');
    });

    it('defaults alias-host login redirect to the tenant root', async () => {
      setMockLocation({
        pathname: '/login',
        search: '',
        origin: 'http://aef.localhost:5173',
        host: 'aef.localhost:5173',
      });

      const { redirectToLogin } = await loadAuthModule();

      redirectToLogin();

      expect(mockAssign).toHaveBeenCalledTimes(1);
      const url = new URL(getAssignedUrl());
      expect(url.origin).toBe('http://portal.localhost:5173');
      expect(url.searchParams.get('next')).toBe('/t/aef/');
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
