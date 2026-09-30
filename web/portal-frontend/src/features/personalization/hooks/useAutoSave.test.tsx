import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './useAutoSave';

afterEach(() => vi.useRealTimers());

describe('settings autosave', () => {
  it('queues changes made during an in-flight save', async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    const onSave = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => { complete = r; })).mockResolvedValue(undefined);
    const {result, rerender} = renderHook(({data}) => useAutoSave({data, onSave, delay: 10}), {initialProps: {data: 'initial'}});
    rerender({data: 'first'});
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    rerender({data: 'latest'});
    await act(async () => { complete(); });
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(onSave.mock.calls.map(([value]) => value)).toEqual(['first', 'latest']);
    expect(result.current.isDirty).toBe(false);
  });

  it('does not silently retry a failed write and supports an explicit retry', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const {result, rerender} = renderHook(({data}) => useAutoSave({data, onSave, delay: 10}), {initialProps: {data: 'initial'}});
    rerender({data: 'changed'});
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.error?.message).toBe('offline');
    await act(async () => { await result.current.save(); });
    expect(result.current.isDirty).toBe(false);
  });
});
