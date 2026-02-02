import { logger } from '../utils/logger';
import type { CommandVisitor, SerializableCommand, SerializedCommand } from './types';

export type CommandHistoryState = {
  cursor: number;
  size: number;
  canUndo: boolean;
  canRedo: boolean;
};

type HistoryListener = (state: CommandHistoryState) => void;

export class CommandHistory {
  private commands: SerializableCommand[] = [];
  private cursor = -1;
  private listeners = new Set<HistoryListener>();

  constructor(private readonly limit = 30) {}

  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  getState(): CommandHistoryState {
    return {
      cursor: this.cursor,
      size: this.commands.length,
      canUndo: this.cursor >= 0,
      canRedo: this.cursor < this.commands.length - 1,
    };
  }

  canUndo(): boolean {
    return this.getState().canUndo;
  }

  canRedo(): boolean {
    return this.getState().canRedo;
  }

  async run(command: SerializableCommand): Promise<void> {
    await command.execute();
    this.commands = this.commands.slice(0, this.cursor + 1);
    this.commands.push(command);
    if (this.commands.length > this.limit) {
      this.commands.shift();
    }
    this.cursor = this.commands.length - 1;
    this.notify();
  }

  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;
    const command = this.commands[this.cursor];
    try {
      await command.undo();
      this.cursor -= 1;
      this.notify();
      return true;
    } catch (error) {
      logger.error('Undo failed', {
        area: 'commands',
        event: 'undo_failed',
        data: { command: command.name, kind: command.kind },
        error,
      });
      throw error;
    }
  }

  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;
    const command = this.commands[this.cursor + 1];
    try {
      await command.redo();
      this.cursor += 1;
      this.notify();
      return true;
    } catch (error) {
      logger.error('Redo failed', {
        area: 'commands',
        event: 'redo_failed',
        data: { command: command.name, kind: command.kind },
        error,
      });
      throw error;
    }
  }

  serialize(visitor: CommandVisitor<SerializedCommand>): SerializedCommand[] {
    return this.commands.map((command) => command.accept(visitor));
  }
}
