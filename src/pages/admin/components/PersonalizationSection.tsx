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

export const PersonalizationSection: React.FC<PersonalizationSectionProps> = ({
  modals,
  isLoading,
  error,
  onSelectModal,
  onCreateModal,
  onEditModal,
  onDeleteModal,
}) => {
  const columns: TableColumnConfig<HomePageModal>[] = [
    {
      id: 'title',
      name: 'Заголовок',
      template: (item) => item.title,
    },
    {
      id: 'modalType',
      name: 'Тип',
      width: 140,
      template: (item) => modalTypeLabels[item.modalType] ?? item.modalType,
    },
    {
      id: 'startDate',
      name: 'Начало показа',
      width: 180,
      template: (item) => formatDate(item.startDate),
    },
    {
      id: 'endDate',
      name: 'Окончание показа',
      width: 180,
      template: (item) => formatDate(item.endDate),
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
      template: (item) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="s"
            view="outlined"
            onClick={(event) => {
              event.stopPropagation();
              onEditModal(item);
            }}
          >
            Редактировать
          </Button>
          <Button
            size="s"
            view="flat-danger"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteModal(item.id);
            }}
          >
            Удалить
          </Button>
        </div>
      ),
    },
  ];

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
              data={modals}
              columns={columns}
              getRowId={(item) => String(item.id)}
              onRowClick={(item) => onSelectModal(item.id)}
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
