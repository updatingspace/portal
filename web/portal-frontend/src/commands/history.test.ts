import { describe, expect, it, vi } from 'vitest';

import { CommandHistory } from './history';
import type { SerializableCommand } from './types';

const makeCommand = (name: string): SerializableCommand => ({
  kind: 'test',
  name,
  execute: vi.fn(async () => undefined),
  undo: vi.fn(async () => undefined),
  redo: vi.fn(async () => undefined),
  serialize: () => ({ name }),
  accept: (visitor) => visitor.visit({ kind: 'test', name, payload: { name }, timestamp: Date.now() }),
});

describe('CommandHistory business rules', () => {
  it('runs, stores and trims by limit', async () => {
    const history = new CommandHistory(2);
    const c1 = makeCommand('c1');
    const c2 = makeCommand('c2');
    const c3 = makeCommand('c3');

    await history.run(c1);
    await history.run(c2);
    await history.run(c3);

    expect(history.getState()).toMatchObject({ size: 2, cursor: 1, canUndo: true, canRedo: false });
  });

  it('supports undo/redo flow and guards on boundaries', async () => {
    const history = new CommandHistory();
    const c1 = makeCommand('c1');
    await history.run(c1);

    expect(await history.undo()).toBe(true);
    expect(c1.undo).toHaveBeenCalled();
    expect(await history.undo()).toBe(false);

    expect(await history.redo()).toBe(true);
    expect(c1.redo).toHaveBeenCalled();
    expect(await history.redo()).toBe(false);
  });

  it('drops redo branch when new command runs after undo', async () => {
    const history = new CommandHistory();
    const c1 = makeCommand('c1');
    const c2 = makeCommand('c2');
    const c3 = makeCommand('c3');

    await history.run(c1);
    await history.run(c2);
    await history.undo();
    await history.run(c3);

    expect(history.getState()).toMatchObject({ size: 2, cursor: 1, canRedo: false });
  });

  it('notifies subscribers and serializes through visitor', async () => {
    const history = new CommandHistory();
    const listener = vi.fn();
    const unsubscribe = history.subscribe(listener);

    await history.run(makeCommand('c1'));
    expect(listener).toHaveBeenCalled();

    const serialized = history.serialize({
      visit: vi.fn((data) => ({
        kind: data.kind,
        name: data.name,
        payload: data.payload,
        timestamp: data.timestamp,
      })),
    });

    expect(serialized).toHaveLength(1);
    unsubscribe();
  });
});
