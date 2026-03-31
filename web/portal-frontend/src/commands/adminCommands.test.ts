import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportVotingCommand, SaveGameCommand } from './adminCommands';
import * as votingsApi from '../api/votings';
import * as gamesApi from '../api/games';
import { ApiError } from '../api/client';

vi.mock('../api/votings', () => ({
  exportVoting: vi.fn(),
  importVoting: vi.fn(),
  deleteVoting: vi.fn(),
}));

vi.mock('../api/games', () => ({
  createGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
}));

describe('adminCommands business flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ImportVotingCommand imports with force when snapshot exists and can undo/redo', async () => {
    vi.mocked(votingsApi.exportVoting).mockResolvedValueOnce({
      code: 'vote-1',
      title: 'Old',
      nominations: [],
    } as never);

    vi.mocked(votingsApi.importVoting)
      .mockResolvedValueOnce({ voting: { code: 'vote-1' }, replacedExisting: true } as never)
      .mockResolvedValueOnce({ voting: { code: 'vote-1' }, replacedExisting: true } as never)
      .mockResolvedValueOnce({ voting: { code: 'vote-1' }, replacedExisting: true } as never);

    const onSync = vi.fn();
    const onResult = vi.fn();
    const command = new ImportVotingCommand(
      { code: 'vote-1', title: 'New', nominations: [], isActive: true },
      { onSync, onResult },
    );

    await command.execute();
    await command.undo();
    await command.redo();

    expect(votingsApi.importVoting).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ code: 'vote-1' }),
      { force: true },
    );
    expect(onSync).toHaveBeenCalledWith(expect.anything(), 'apply');
    expect(onSync).toHaveBeenCalledWith(expect.anything(), 'undo');
    expect(onSync).toHaveBeenCalledWith(expect.anything(), 'redo');
    expect(onResult).toHaveBeenCalled();
  });

  it('ImportVotingCommand handles not_found snapshot by deleting on undo', async () => {
    vi.mocked(votingsApi.exportVoting).mockRejectedValueOnce(new ApiError('not found', { kind: 'not_found', status: 404 }));
    vi.mocked(votingsApi.importVoting).mockResolvedValueOnce({ voting: { code: 'vote-2' }, replacedExisting: false } as never);
    vi.mocked(votingsApi.deleteVoting).mockResolvedValueOnce(undefined);

    const onSync = vi.fn();
    const command = new ImportVotingCommand(
      { code: 'vote-2', title: 'Brand new', nominations: [], isActive: true },
      { onSync },
    );

    await command.execute();
    await command.undo();

    expect(votingsApi.deleteVoting).toHaveBeenCalledWith('vote-2');
    expect(onSync).toHaveBeenCalledWith(null, 'undo');
  });

  it('SaveGameCommand create/update undo/redo business path', async () => {
    vi.mocked(gamesApi.createGame).mockResolvedValueOnce({ id: 'g1', title: 'Game 1' } as never);
    vi.mocked(gamesApi.deleteGame).mockResolvedValueOnce(undefined);

    const syncCreate = vi.fn();
    const createCommand = new SaveGameCommand({ title: 'Game 1' }, null, { onSync: syncCreate });
    await createCommand.execute();
    await createCommand.undo();
    await createCommand.redo();

    expect(gamesApi.createGame).toHaveBeenCalledTimes(2);
    expect(gamesApi.deleteGame).toHaveBeenCalledWith('g1');
    expect(syncCreate).toHaveBeenCalledWith(null, 'undo', { deletedId: 'g1' });

    vi.mocked(gamesApi.updateGame)
      .mockResolvedValueOnce({ id: 'g2', title: 'Updated' } as never)
      .mockResolvedValueOnce({ id: 'g2', title: 'Old' } as never)
      .mockResolvedValueOnce({ id: 'g2', title: 'Updated' } as never);

    const syncUpdate = vi.fn();
    const updateCommand = new SaveGameCommand(
      { title: 'Updated' },
      { id: 'g2', title: 'Old' } as never,
      { onSync: syncUpdate },
    );

    await updateCommand.execute();
    await updateCommand.undo();
    await updateCommand.redo();

    expect(gamesApi.updateGame).toHaveBeenCalledWith('g2', expect.objectContaining({ title: 'Updated' }));
    expect(syncUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Old' }), 'undo');
  });
});
