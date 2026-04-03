import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  it('tracks browser online/offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(typeof result.current).toBe('boolean');

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
