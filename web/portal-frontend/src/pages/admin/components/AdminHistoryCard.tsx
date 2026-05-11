import React from 'react';
import { Button, Card } from '@gravity-ui/uikit';
import type { SerializedCommand } from '../../../commands/types';
import { useFormatters } from '@/shared/hooks/useFormatters';

type AdminHistoryCardProps = {
  serializedCommands: SerializedCommand[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export const AdminHistoryCard: React.FC<AdminHistoryCardProps> = ({
  serializedCommands,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const { formatTime } = useFormatters();

  return (
    <Card className="admin-card">
      <div className="admin-card-head">
        <div>
          <div className="admin-card-title">История изменений</div>
          <div className="text-muted small">
            До 30 последних команд. Используйте Ctrl+Z и Ctrl+Shift+Z или кнопки ниже.
          </div>
        </div>
        <div className="admin-history-actions">
          <Button size="s" view="flat-secondary" onClick={onUndo} disabled={!canUndo}>
            Отменить
          </Button>
          <Button size="s" view="flat-secondary" onClick={onRedo} disabled={!canRedo}>
            Повторить
          </Button>
        </div>
      </div>
      {serializedCommands.length ? (
        <div className="admin-news-list">
          {serializedCommands
            .slice(-5)
            .reverse()
            .map((item) => (
              <div key={item.id} className="admin-news-item">
                <div className="admin-news-body">
                  <div className="admin-news-title">{item.name}</div>
                  <div className="text-muted small">
                    {formatTime(item.timestamp)} · {item.kind}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-muted small">
          История пуста. Создайте игру, измените данные или импортируйте голосование, чтобы увидеть записи.
        </div>
      )}
    </Card>
  );
};
