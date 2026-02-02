import type { CommandKind, CommandVisitor, SerializableCommand } from './types';
import { createCommandId } from './types';

export abstract class BaseCommand implements SerializableCommand {
  readonly id: string = createCommandId();
  readonly timestamp: number = Date.now();

  protected constructor(public readonly kind: CommandKind, public readonly name: string) {}

  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract redo(): Promise<void>;
  abstract serialize(): Record<string, unknown>;

  accept<Result>(visitor: CommandVisitor<Result>): Result {
    return visitor.visit(this);
  }
}
