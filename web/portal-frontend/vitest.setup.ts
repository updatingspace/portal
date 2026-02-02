import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Stub only the Gravity UI ToasterComponent in tests to avoid
// portal-related selector issues in jsdom/nwsapi. All other
// components are kept as-is.
vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');

  const SafeToasterComponent = () => null;

  return {
    ...actual,
    ToasterComponent: SafeToasterComponent,
  };
});

import {
  activityApiMock,
  adminVotingsApiMock,
  gamesApiMock,
  nominationsApiMock,
  resetAllApiMocks,
  serviceApiMock,
  votingsApiMock,
} from './src/test/mocks/api';

vi.mock('./src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  },
}));

vi.mock('./src/api/votings', () => votingsApiMock);
vi.mock('./src/api/nominations', () => nominationsApiMock);
vi.mock('./src/services/api', () => serviceApiMock);
vi.mock('./src/api/adminVotings', () => adminVotingsApiMock);
vi.mock('./src/api/games', () => gamesApiMock);
vi.mock('./src/api/activity', () => activityApiMock);

const noop = () => {};

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  };
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  });
}

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = noop;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = noop as typeof HTMLElement.prototype.scrollIntoView;
}

// Gravity UI + jsdom can occasionally generate selectors that are not valid
// for the underlying nwsapi engine (e.g. when portal IDs contain colons).
// Guard Element.matches so such selectors fail quietly instead of crashing
// the entire test with a SyntaxError.
if (typeof Element !== 'undefined') {
  const originalMatches = Element.prototype.matches;

  Element.prototype.matches = function patchedMatches(selector: string): boolean {
    try {
      return originalMatches.call(this, selector);
    } catch (error) {
      // If selector parsing fails, treat it as non-match instead of throwing.
      if (error instanceof SyntaxError) {
        return false;
      }
      throw error;
    }
  };
}

beforeEach(() => {
  resetAllApiMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
