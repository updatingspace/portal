export type CommandKind = 'import_voting' | 'save_game';

export type SerializedCommand = {
  id: string;
  kind: CommandKind;
  name: string;
  timestamp: number;
  payload?: Record<string, unknown>;
};

export interface CommandVisitor<Result = unknown> {
  visit(command: SerializableCommand): Result;
}

export interface SerializableCommand {
  readonly id: string;
  readonly kind: CommandKind;
  readonly name: string;
  readonly timestamp: number;
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  redo(): Promise<void> | void;
  serialize(): Record<string, unknown>;
  accept<Result>(visitor: CommandVisitor<Result>): Result;
}

export const createCommandId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
