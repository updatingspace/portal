import React from 'react';
import { Card, Dialog, Loader } from '@gravity-ui/uikit';

import type { Nomination } from '../../data/nominations';

type PreviewDialogProps = {
  open: boolean;
  nomination: Nomination | null;
  onClose: () => void;
  isLoading: boolean;
};

export const NominationPreviewDialog: React.FC<PreviewDialogProps> = ({
  open,
  nomination,
  onClose,
  isLoading,
}) => (
  <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
    <Dialog.Header caption="Предпросмотр карточки игры" />
    <Dialog.Body>
      {isLoading || !nomination ? (
        <div className="admin-loader-box">
          <Loader size="m" />
          <div className="text-muted small">Загружаем карточки...</div>
        </div>
      ) : (
        <div className="option-grid-roomy">
          {nomination.options.map((option) => (
            <Card key={option.id} className="option-card">
                <div className="option-card-cover">
                  {option.imageUrl ? (
                    <img
                      src={option.imageUrl}
                      alt={`Обложка игры ${option.title}`}
                      className="option-card-cover-img"
                    />
                  ) : (
                  <div className="option-card-cover-placeholder">
                    <span className="option-card-cover-accent">Кадр игры</span>
                    <span className="option-card-cover-note">
                      Используйте ссылку в редакторе, чтобы добавить изображение.
                    </span>
                  </div>
                )}
                <div className="option-card-overlay">
                  <div className="option-card-overlay-text">
                    {option.game?.genre ? `Жанр: ${option.game.genre}` : 'Жанр - ?'}
                  </div>
                </div>
              </div>
              <div className="option-card-footer">
                <div className="option-card-header">
                  <div className="option-card-title">{option.title}</div>
                  <div className="option-card-votes text-muted">Ховер-эффект: жанр</div>
                </div>
                <div className="option-card-subtitle text-muted">
                  {option.game?.genre ?? 'Жанр не указан'}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Dialog.Body>
  </Dialog>
);
