import React from 'react';
import { Button, Card, Icon, Loader, Switch, Table, TextInput, type TableColumnConfig } from '@gravity-ui/uikit';
import ArrowUpRightFromSquare from '@gravity-ui/icons/ArrowUpRightFromSquare';
import Gear from '@gravity-ui/icons/Gear';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Pencil from '@gravity-ui/icons/Pencil';
import type { AdminVoting, AdminVotingListItem } from '../../../api/adminVotings';
import type { Nomination } from '../../../data/nominations';
import { NominationPreviewPanel } from '../../../components/admin/NominationPreviewPanel';
import type { MetaDraftState, NominationRow } from '../types';

type VotingsSectionProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateVoting: () => void;
  onOpenImport: () => void;
  onExportVoting: () => void;
  onDeleteVoting: () => void;
  isDeletingVoting: boolean;
  votingsError: string | null;
  votings: AdminVotingListItem[];
  isListLoading: boolean;
  selectedVotingId: string | null;
  onSelectVoting: (id: string) => void;
  onOpenVotingPublic: (id: string) => void;
  selectedVoting: AdminVoting | null;
  isDetailLoading: boolean;
  isEditingMeta: boolean;
  metaDraft: MetaDraftState;
  onStartEditMeta: () => void;
  onCancelEditMeta: () => void;
  onMetaChange: (patch: Partial<MetaDraftState>) => void;
  onSaveMeta: () => void;
  onCloseVotingNow: () => void;
  isSavingMeta: boolean;
  isClosingVoting: boolean;
  nominationColumns: TableColumnConfig<NominationRow>[];
  nominationRows: NominationRow[];
  previewNomination: Nomination | null;
  isPreviewLoading: boolean;
  onOpenPreviewDialog: () => void;
  statusLabels: Record<string, string>;
  formatDeadline: (value?: string | null) => string;
};

export const VotingsSection: React.FC<VotingsSectionProps> = ({
  search,
  onSearchChange,
  onCreateVoting,
  onOpenImport,
  onExportVoting,
  onDeleteVoting,
  isDeletingVoting,
  votingsError,
  votings,
  isListLoading,
  selectedVotingId,
  onSelectVoting,
  onOpenVotingPublic,
  selectedVoting,
  isDetailLoading,
  isEditingMeta,
  metaDraft,
  onStartEditMeta,
  onCancelEditMeta,
  onMetaChange,
  onSaveMeta,
  onCloseVotingNow,
  isSavingMeta,
  isClosingVoting,
  nominationColumns,
  nominationRows,
  previewNomination,
  isPreviewLoading,
  onOpenPreviewDialog,
  statusLabels,
  formatDeadline,
}) => (
  <div className="admin-voting-layout">
    <div className="admin-search-row">
      <TextInput
        size="l"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Умный поиск по названиям голосований"
        startContent={<Icon data={Magnifier} size={16} />}
        hasClear
      />
      <Button size="m" view="action" onClick={onCreateVoting}>
        Создать голосование
      </Button>
      <Button size="m" view="flat-secondary" onClick={onOpenImport}>
        Импорт JSON
      </Button>
      <Button size="m" view="outlined" onClick={onExportVoting} disabled={!selectedVotingId}>
        <Icon data={ArrowUpRightFromSquare} size={14} /> Экспорт текущего
      </Button>
      <Button size="m" view="outlined" onClick={onDeleteVoting} disabled={!selectedVotingId || isDeletingVoting}>
        {isDeletingVoting ? 'Удаляем...' : 'Удалить'}
      </Button>
      {votingsError && <div className="text-warning small">{votingsError}</div>}
    </div>

    <div className="admin-voting-grid">
      {isListLoading ? (
        <div className="admin-loader-box">
          <Loader size="m" />
          <div className="text-muted small">Подтягиваем голосования...</div>
        </div>
      ) : votings.length ? (
        votings.map((item) => (
          <Card
            key={item.id}
            className={'admin-voting-card' + (selectedVotingId === item.id ? ' admin-voting-card-active' : '')}
            onClick={() => onSelectVoting(item.id)}
          >
            <div className="admin-voting-card-top">
              <span className={`admin-status admin-status-${item.status}`}>
                {statusLabels[item.status] ?? item.status}
              </span>
              <span className="text-muted small">{formatDeadline(item.deadlineAt)}</span>
            </div>
            <div className="admin-voting-title">{item.title}</div>
            <div className="text-muted admin-voting-desc">
              {item.description ?? 'Добавьте описание, чтобы модераторы понимали контекст.'}
            </div>
            <div className="admin-voting-meta">
              <span className="text-muted small">Номинаций: {item.nominationCount}</span>
              <div className="admin-voting-actions">
                <Button
                  size="s"
                  view="flat"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenVotingPublic(item.id);
                  }}
                >
                  <Icon data={ArrowUpRightFromSquare} size={14} /> Ознакомиться
                </Button>
                <Button
                  size="s"
                  view="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectVoting(item.id);
                  }}
                >
                  <Icon data={Gear} size={14} /> Настройки
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="status-block status-block-warning">
          <div className="status-title">По запросу ничего не нашли</div>
          <p className="text-muted mb-0">Попробуйте изменить поисковый запрос или убрать фильтры.</p>
        </div>
      )}
    </div>

    {selectedVoting ? (
      <Card className="admin-card admin-detail-card">
        {isDetailLoading ? (
          <div className="admin-loader-box">
            <Loader size="m" />
            <div className="text-muted small">Загружаем детали голосования...</div>
          </div>
        ) : (
          <>
            <div className="admin-detail-title-row">
              {isEditingMeta ? (
                <TextInput
                  size="l"
                  value={metaDraft.title}
                  onChange={(event) => onMetaChange({ title: event.target.value })}
                  placeholder="Название голосования"
                />
              ) : (
                <div className="admin-detail-title">{selectedVoting.title}</div>
              )}
              <Button size="s" view="flat-secondary" onClick={isEditingMeta ? onCancelEditMeta : onStartEditMeta}>
                <Icon data={Pencil} size={14} /> {isEditingMeta ? 'Правим' : 'Редактировать'}
              </Button>
            </div>
            <div className="text-muted small mb-2">
              Дедлайн: {formatDeadline(selectedVoting.deadlineAt)} · Статус:{' '}
              {statusLabels[selectedVoting.status] ?? selectedVoting.status} · Видимость:{' '}
              {selectedVoting.isPublished ? 'Опубликовано' : 'Черновик'} · Результаты:{' '}
              {selectedVoting.showVoteCounts ? 'Показываем' : 'Скрыты'}
            </div>
            {isEditingMeta ? (
              <>
                <textarea
                  className="admin-editable-textarea"
                  rows={4}
                  value={metaDraft.description}
                  onChange={(event) => onMetaChange({ description: event.target.value })}
                  placeholder="Описание голосования"
                />
                <div className="admin-detail-controls">
                  <div className="admin-game-field">
                    <div className="text-muted small">Дедлайн голосования</div>
                    <TextInput
                      size="m"
                      type="text"
                      value={metaDraft.deadlineAt}
                      onChange={(event) => onMetaChange({ deadlineAt: event.target.value })}
                      placeholder="Без дедлайна"
                    />
                  </div>
                  <div className="admin-game-field">
                    <div className="text-muted small">Публикация</div>
                    <Switch
                      size="m"
                      checked={metaDraft.isPublished}
                      onUpdate={(checked) => onMetaChange({ isPublished: checked })}
                    >
                      {metaDraft.isPublished ? 'Опубликовано' : 'Черновик'}
                    </Switch>
                    <div className="text-muted small mt-1">
                      Отключите публикацию, чтобы подготовить черновик без доступа для пользователей.
                    </div>
                  </div>
                  <div className="admin-game-field">
                    <div className="text-muted small">Активность</div>
                    <Switch
                      size="m"
                      checked={metaDraft.isActive}
                      onUpdate={(checked) => onMetaChange({ isActive: checked })}
                    >
                      {metaDraft.isActive ? 'Открыто' : 'Архив'}
                    </Switch>
                    <div className="text-muted small mt-1">
                      Переключите в «Архив», чтобы скрыть голосование из активных потоков.
                    </div>
                  </div>
                </div>
                <div className="admin-detail-actions">
                  <Button view="action" size="m" disabled={isSavingMeta} onClick={onSaveMeta}>
                    {isSavingMeta ? 'Сохраняем...' : 'Сохранить'}
                  </Button>
                  <Button view="flat-secondary" size="m" onClick={onCancelEditMeta} disabled={isSavingMeta}>
                    Отмена
                  </Button>
                  <Button view="outlined" size="m" onClick={onCloseVotingNow} disabled={isSavingMeta || isClosingVoting}>
                    {isClosingVoting ? 'Завершаем...' : 'Завершить сейчас'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="admin-detail-description">
                {selectedVoting.description ?? 'Описание пока не задано.'}
              </p>
            )}

            <div className="admin-detail-subtitle">Номинации</div>
            <Table
              columns={nominationColumns}
              data={nominationRows}
              emptyMessage="Номинации появятся после настройки голосования."
              getRowDescriptor={(row) => ({ id: row.id })}
              width="max"
            />
            <NominationPreviewPanel nomination={previewNomination} isLoading={isPreviewLoading} onOpenDialog={onOpenPreviewDialog} />
          </>
        )}
      </Card>
    ) : null}
  </div>
);
