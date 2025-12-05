import React from 'react';
import { Button, Card, Icon, Loader, TextInput } from '@gravity-ui/uikit';
import Pencil from '@gravity-ui/icons/Pencil';
import Magnifier from '@gravity-ui/icons/Magnifier';

import type { Game } from '../../types/games';
import { formatReleaseYear } from '../../utils/format';

type GameGridProps = {
  filteredGames: Game[];
  selectedGameId: string | null;
  search: string;
  isLoading: boolean;
  error?: string | null;
  onSearchChange: (value: string) => void;
  onSelectGame: (game: Game) => void;
  onOpenEditor: (game: Game) => void;
  onOpenCreate: () => void;
};

export const GameGrid: React.FC<GameGridProps> = ({
  filteredGames,
  selectedGameId,
  search,
  isLoading,
  error,
  onSearchChange,
  onSelectGame,
  onOpenEditor,
  onOpenCreate,
}) => (
  <>
    <div className="admin-search-row admin-games-search">
      <TextInput
        size="l"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Поиск игр по названию, жанру, студии"
        startContent={<Icon data={Magnifier} size={16} />}
        hasClear
      />
      <Button size="s" view="flat-secondary" onClick={onOpenCreate}>
        Добавить игру
      </Button>
      {error && <div className="text-warning small">{error}</div>}
    </div>
    <div className="admin-voting-grid">
      {isLoading ? (
        <div className="admin-loader-box">
          <Loader size="m" />
          <div className="text-muted small">Подтягиваем каталог игр...</div>
        </div>
      ) : filteredGames.length ? (
        filteredGames.map((game) => (
          <Card
            key={game.id}
            className={`admin-voting-card${selectedGameId === game.id ? ' admin-voting-card-active' : ''}`}
            onClick={() => onSelectGame(game)}
          >
            <div className="admin-game-card-cover">
              {game.imageUrl ? (
                <img
                  src={game.imageUrl}
                  alt={`Обложка ${game.title}`}
                  className="admin-game-card-cover-img"
                />
              ) : (
                <div className="admin-game-card-cover-placeholder">
                  <span className="admin-game-cover-accent">Кадр игры</span>
                  <span className="admin-game-cover-note">
                    Добавьте ссылку на изображение в редакторе.
                  </span>
                </div>
              )}
              <div className="admin-game-card-overlay">
                <span className="admin-game-card-overlay-text">
                  {game.genre?.trim() ? `Жанр: ${game.genre}` : 'Жанр - ?'}
                </span>
              </div>
            </div>
            <div className="admin-voting-title">{game.title}</div>
            <div className="text-muted admin-voting-desc">
              {game.studio || 'Студия не указана'}
            </div>
            <div className="admin-voting-meta">
              <span className="text-muted small">
                Год: {formatReleaseYear(game.releaseYear)}
              </span>
              <div className="admin-voting-actions">
                <Button
                  size="s"
                  view="flat"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenEditor(game);
                  }}
                >
                  <Icon data={Pencil} size={14} /> Редактировать
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="status-block status-block-warning">
          <div className="status-title">Игр пока нет</div>
          <p className="text-muted mb-0">
            Добавьте запись через форму, чтобы получить карточку и привязать к номинации.
          </p>
        </div>
      )}
    </div>
  </>
);
