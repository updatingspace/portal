import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useFeedFilters } from './useFeedFilters';

function createWrapper(initialEntry: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/app/feed" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

describe('useFeedFilters', () => {
  it('hydrates filter state from URL', () => {
    const { result } = renderHook(() => useFeedFilters(), {
      wrapper: createWrapper('/app/feed?source=events&period=month&sort=recent'),
    });

    expect(result.current.source).toBe('events');
    expect(result.current.period).toBe('month');
    expect(result.current.sort).toBe('recent');
  });

  it('falls back to defaults for invalid params', () => {
    const { result } = renderHook(() => useFeedFilters(), {
      wrapper: createWrapper('/app/feed?source=invalid&period=invalid&sort=invalid'),
    });

    expect(result.current.source).toBe('all');
    expect(result.current.period).toBe('week');
    expect(result.current.sort).toBe('best');
  });

  it('updates source and reflects active filters', () => {
    const { result } = renderHook(() => useFeedFilters(), {
      wrapper: createWrapper('/app/feed'),
    });

    act(() => result.current.setSource('news'));
    expect(result.current.source).toBe('news');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resets filters to defaults', () => {
    const { result } = renderHook(() => useFeedFilters(), {
      wrapper: createWrapper('/app/feed?source=events&period=day&sort=recent'),
    });

    act(() => result.current.resetFilters());
    expect(result.current.source).toBe('all');
    expect(result.current.period).toBe('week');
    expect(result.current.sort).toBe('best');
  });
});
