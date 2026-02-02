import { isApiError } from '../api/client';
import {
  deleteVoting,
  exportVoting,
  importVoting,
  type VotingImportPayload,
  type VotingImportResult,
} from '../api/votings';
import { createGame, deleteGame, updateGame } from '../api/games';
import type { Game } from '../types/games';
import { BaseCommand } from './baseCommand';

type SyncAction = 'apply' | 'undo' | 'redo';

type VotingSyncHandler = (voting: VotingImportPayload | null, action: SyncAction) => void;
type GameSyncMeta = { deletedId?: string };
type GameSyncHandler = (game: Game | null, action: SyncAction, meta?: GameSyncMeta) => void;

type ImportVotingCommandOptions = {
  force?: boolean;
  onSync?: VotingSyncHandler;
  onResult?: (result: VotingImportResult) => void;
};

export class ImportVotingCommand extends BaseCommand {
  private previousSnapshot: VotingImportPayload | null = null;
  private lastResult: VotingImportResult | null = null;

  constructor(
    private readonly payload: VotingImportPayload,
    private readonly options: ImportVotingCommandOptions = {},
  ) {
    super('import_voting', `Импорт голосования ${payload.code}`);
  }

  private async captureExisting(): Promise<void> {
    if (this.previousSnapshot) return;
    try {
      this.previousSnapshot = await exportVoting(this.payload.code);
    } catch (error) {
      if (!isApiError(error) || error.kind !== 'not_found') {
        throw error;
      }
    }
  }

  private async applyImport(action: SyncAction, target: VotingImportPayload, force: boolean): Promise<void> {
    const result = await importVoting(target, { force });
    this.lastResult = result;
    this.options.onResult?.(result);
    this.options.onSync?.(result.voting, action);
  }

  async execute(): Promise<void> {
    await this.captureExisting();
    const forceFlag = this.options.force ?? Boolean(this.previousSnapshot);
    await this.applyImport('apply', this.payload, forceFlag);
  }

  async undo(): Promise<void> {
    if (this.previousSnapshot) {
      await this.applyImport('undo', this.previousSnapshot, true);
    } else {
      await deleteVoting(this.payload.code);
      this.options.onSync?.(null, 'undo');
    }
  }

  async redo(): Promise<void> {
    await this.applyImport('redo', this.payload, true);
  }

  serialize(): Record<string, unknown> {
    const optionCount = this.payload.nominations.reduce(
      (total, nomination) => total + nomination.options.length,
      0,
    );
    return {
      code: this.payload.code,
      nominations: this.payload.nominations.length,
      options: optionCount,
      force: this.options.force ?? Boolean(this.previousSnapshot),
      replacedExisting: this.lastResult?.replacedExisting ?? null,
    };
  }
}

type SaveGameCommandOptions = {
  onSync?: GameSyncHandler;
};

export class SaveGameCommand extends BaseCommand {
  private lastSaved: Game | null = null;

  constructor(
    private readonly payload: Partial<Game>,
    private readonly previousGame: Game | null,
    private readonly options: SaveGameCommandOptions = {},
  ) {
    super('save_game', previousGame ? `Обновление игры ${previousGame.id}` : 'Создание игры');
  }

  private async apply(action: SyncAction): Promise<Game> {
    const result = this.previousGame
      ? await updateGame(this.previousGame.id, this.payload)
      : await createGame(this.payload);
    this.lastSaved = result;
    this.options.onSync?.(result, action);
    return result;
  }

  async execute(): Promise<void> {
    await this.apply('apply');
  }

  async undo(): Promise<void> {
    if (!this.previousGame) {
      if (this.lastSaved) {
        await deleteGame(this.lastSaved.id);
      }
      this.options.onSync?.(null, 'undo', { deletedId: this.lastSaved?.id });
      return;
    }

    const reverted = await updateGame(this.previousGame.id, this.previousGame);
    this.lastSaved = reverted;
    this.options.onSync?.(reverted, 'undo');
  }

  async redo(): Promise<void> {
    await this.apply('redo');
  }

  serialize(): Record<string, unknown> {
    return {
      mode: this.previousGame ? 'update' : 'create',
      gameId: this.previousGame?.id ?? this.lastSaved?.id ?? null,
      title: this.payload.title ?? this.previousGame?.title ?? null,
    };
  }
}
