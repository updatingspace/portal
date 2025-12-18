import React from 'react';
import { Button, Card, Loader, Table, type TableColumnConfig } from '@gravity-ui/uikit';
import type { HomePageModal } from '../../../api/personalization';

interface PersonalizationSectionProps {
  modals: HomePageModal[];
  isLoading: boolean;
  error: string | null;
  selectedModalId: number | null;
  onSelectModal: (id: number) => void;
  onCreateModal: () => void;
  onEditModal: (modal: HomePageModal) => void;
  onDeleteModal: (id: number) => void;
}

const modalTypeLabels: Record<string, string> = {
  info: 'Информация',
  warning: 'Предупреждение',
  success: 'Успех',
  promo: 'Промо',
};

const formatDate = (date: string | null): string => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
};

type TableRow = Omit<HomePageModal, 'id'> & { id: string };

export const PersonalizationSection: React.FC<PersonalizationSectionProps> = ({
  modals,
  isLoading,
  error,
  onSelectModal,
  onCreateModal,
  onEditModal,
  onDeleteModal,
}) => {
  const columns: TableColumnConfig<TableRow>[] = [
    {
      id: 'title',
      name: 'Заголовок',
      template: (item) => item.title,
    },
    {
      id: 'modal_type',
      name: 'Тип',
      width: 140,
      template: (item) => modalTypeLabels[item.modal_type] ?? item.modal_type,
    },
    {
      id: 'start_date',
      name: 'Начало показа',
      width: 180,
      template: (item) => formatDate(item.start_date),
    },
    {
      id: 'end_date',
      name: 'Окончание показа',
      width: 180,
      template: (item) => formatDate(item.end_date),
    },
    {
      id: 'order',
      name: 'Порядок',
      width: 100,
      template: (item) => String(item.order),
    },
    {
      id: 'actions',
      name: 'Действия',
      width: 220,
      template: (item) => {
        const originalModal = modals.find(m => String(m.id) === item.id);
        return originalModal ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="s" view="outlined" onClick={() => onEditModal(originalModal)}>
              Редактировать
            </Button>
            <Button size="s" view="flat-danger" onClick={() => onDeleteModal(originalModal.id)}>
              Удалить
            </Button>
          </div>
        ) : null;
      },
    },
  ];
  
  const data: TableRow[] = modals.map((modal) => ({
    ...modal,
    id: String(modal.id),
  }));

  return (
    <div className="admin-section">
      <Card view="filled" className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Модальные окна — Главная</h2>
            <p className="text-muted mb-0">
              Управление модальными окнами, которые отображаются на главной странице
            </p>
          </div>
          <Button view="action" size="l" onClick={onCreateModal}>
            Создать модалку
          </Button>
        </div>

        {error && (
          <div className="status-block status-block-danger mt-3">
            <div className="status-title">Ошибка загрузки</div>
            <p className="text-muted mb-0">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="status-block status-block-info mt-3">
            <Loader size="m" />
            <div className="text-muted mt-2">Загружаем модалки...</div>
          </div>
        ) : modals.length > 0 ? (
          <div className="mt-3">
            <Table
              data={data}
              columns={columns}
              getRowId={(item) => String(item.id)}
              onRowClick={(item) => onSelectModal(Number(item.id))}
            />
          </div>
        ) : (
          <div className="status-block status-block-info mt-3">
            <div className="status-title">Нет модалок</div>
            <p className="text-muted mb-0">
              Создайте первую модалку для отображения на главной странице
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
