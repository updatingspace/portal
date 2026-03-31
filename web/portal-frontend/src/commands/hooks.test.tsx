import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandHistory } from './history';
import { CommandSerializerVisitor } from './visitors';
import { useCommandHistoryState, useCommandHotkeys } from './hooks';

describe('command hooks and serializer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('useCommandHistoryState reflects history updates', async () => {
    const history = new CommandHistory();
    const cmd = {
      kind: 't',
      name: 'c1',
      execute: vi.fn(async () => undefined),
      undo: vi.fn(async () => undefined),
      redo: vi.fn(async () => undefined),
      serialize: () => ({ ok: true }),
      accept: (visitor: { visit: (value: { kind: string; name: string; payload: { ok: boolean }; timestamp: number }) => unknown }) =>
        visitor.visit({ kind: 't', name: 'c1', payload: { ok: true }, timestamp: Date.now() }),
    };

    const { result } = renderHook(() => useCommandHistoryState(history));
    await act(async () => {
      await history.run(cmd as never);
    });
    expect(result.current.size).toBe(1);
  });

  it('useCommandHotkeys triggers undo and redo flows', async () => {
    const history = new CommandHistory();
    const runCmd = {
      kind: 't',
      name: 'c1',
      execute: vi.fn(async () => undefined),
      undo: vi.fn(async () => undefined),
      redo: vi.fn(async () => undefined),
      serialize: () => ({}),
      accept: (visitor: { visit: (value: { kind: string; name: string; payload: {}; timestamp: number }) => unknown }) =>
        visitor.visit({ kind: 't', name: 'c1', payload: {}, timestamp: Date.now() }),
    };
    await history.run(runCmd as never);

    const undoSpy = vi.spyOn(history, 'undo');
    const redoSpy = vi.spyOn(history, 'redo');

    renderHook(() => useCommandHotkeys(history, { enabled: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    });

    expect(undoSpy).toHaveBeenCalled();
    expect(redoSpy).toHaveBeenCalled();
  });

  it('CommandSerializerVisitor omits empty payload and preserves metadata', () => {
    const visitor = new CommandSerializerVisitor();
    const withoutPayload = visitor.visit({
      id: '2',
      kind: 'noop',
      name: 'No-op',
      timestamp: 124,
      serialize: () => ({}),
    });
    expect('payload' in withoutPayload).toBe(false);
  });
});
