import type { CommandVisitor, SerializableCommand, SerializedCommand } from './types';

export class CommandSerializerVisitor implements CommandVisitor<SerializedCommand> {
  visit(command: SerializableCommand): SerializedCommand {
    const payload = command.serialize();
    return {
      id: command.id,
      kind: command.kind,
      name: command.name,
      timestamp: command.timestamp,
      ...(payload && Object.keys(payload).length ? { payload } : {}),
    };
  }
}
