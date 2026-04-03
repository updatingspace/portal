/**
 * Modal table with sorting, filtering, and bulk actions
 */
import {
  Button,
  Checkbox,
  DropdownMenu,
  Icon,
  Label,
  Loader,
  TextInput,
  Select,
  Table,
} from '@gravity-ui/uikit';
import type { TableColumnConfig } from '@gravity-ui/uikit';
import {
  Funnel,
  Pencil,
  TrashBin,
  ArrowRotateLeft,
  CirclePlay,
  CirclePause,
  Eye,
  Ellipsis,
} from '@gravity-ui/icons';
import { useCallback, useMemo, useState } from 'react';
import type {
  HomePageModal,
  ModalListFilters,
  ModalType,
  BulkAction,
} from '../../types';
import { formatDate, getModalTypeColor, getModalTypeLabel } from '../../utils';
import './ModalTable.css';

interface ModalTableProps {
  modals: HomePageModal[];
  isLoading?: boolean;
  filters: ModalListFilters;
  onFiltersChange: (filters: Partial<ModalListFilters>) => void;
  onEdit: (modal: HomePageModal) => void;
  onDelete: (modal: HomePageModal) => void;
  onRestore: (modal: HomePageModal) => void;
  onPreview: (modal: HomePageModal) => void;
  onBulkAction: (ids: number[], action: BulkAction) => Promise<void>;
  selectedIds: number[];
  onSelectionChange: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
}

const MODAL_TYPE_OPTIONS = [
  { value: '', content: 'All Types' },
  { value: 'info', content: 'Info' },
  { value: 'warning', content: 'Warning' },
  { value: 'success', content: 'Success' },
  { value: 'promo', content: 'Promo' },
];

const STATUS_OPTIONS = [
  { value: '', content: 'All Statuses' },
  { value: 'active', content: 'Active' },
  { value: 'inactive', content: 'Inactive' },
];

export function ModalTable({
  modals,
  isLoading,
  filters,
  onFiltersChange,
  onEdit,
  onDelete,
  onRestore,
  onPreview,
  onBulkAction,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  isSomeSelected,
}: ModalTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [isBulkActioning, setIsBulkActioning] = useState(false);

  // Handle bulk action with loading state
  const handleBulkAction = useCallback(
    async (action: BulkAction) => {
      if (selectedIds.length === 0) return;

      setIsBulkActioning(true);
      try {
        await onBulkAction(selectedIds, action);
        onClearSelection();
      } finally {
        setIsBulkActioning(false);
      }
    },
    [selectedIds, onBulkAction, onClearSelection]
  );

  // Table columns configuration
  const columns: TableColumnConfig<HomePageModal>[] = useMemo(
    () => [
      {
        id: 'select',
        name: () => (
          <Checkbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onUpdate={() => (isAllSelected ? onClearSelection() : onSelectAll())}
            aria-label="Select all modals"
          />
        ),
        template: (item: HomePageModal) => (
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onUpdate={() => onSelectionChange(item.id)}
            aria-label={`Select modal ${item.title}`}
          />
        ),
        width: 50,
      },
      {
        id: 'title',
        name: 'Title',
        template: (item: HomePageModal) => (
          <div className="modal-table__title-cell">
            <span
              className={`modal-table__title ${item.deleted_at ? 'modal-table__title--deleted' : ''}`}
            >
              {item.title}
            </span>
            {item.deleted_at && (
              <Label theme="danger" size="xs">
                Deleted
              </Label>
            )}
          </div>
        ),
      },
      {
        id: 'modal_type',
        name: 'Type',
        template: (item: HomePageModal) => (
          <Label theme={getModalTypeColor(item.modal_type)} size="s">
            {getModalTypeLabel(item.modal_type)}
          </Label>
        ),
        width: 120,
      },
      {
        id: 'is_active',
        name: 'Status',
        template: (item: HomePageModal) => (
          <Label theme={item.is_active ? 'success' : 'normal'} size="s">
            {item.is_active ? 'Active' : 'Inactive'}
          </Label>
        ),
        width: 100,
      },
      {
        id: 'start_date',
        name: 'Start Date',
        template: (item: HomePageModal) =>
          item.start_date ? formatDate(item.start_date) : '—',
        width: 130,
      },
      {
        id: 'end_date',
        name: 'End Date',
        template: (item: HomePageModal) =>
          item.end_date ? formatDate(item.end_date) : '—',
        width: 130,
      },
      {
        id: 'order',
        name: 'Order',
        template: (item: HomePageModal) => item.order,
        width: 80,
      },
      {
        id: 'version',
        name: 'Ver.',
        template: (item: HomePageModal) => `v${item.version}`,
        width: 60,
      },
      {
        id: 'actions',
        name: '',
        template: (item: HomePageModal) => (
          <DropdownMenu
            items={[
              [
                {
                  action: () => onPreview(item),
                  text: 'Preview',
                  iconStart: <Icon data={Eye} />,
                },
                {
                  action: () => onEdit(item),
                  text: 'Edit',
                  iconStart: <Icon data={Pencil} />,
                  disabled: !!item.deleted_at,
                },
              ],
              [
                item.deleted_at
                  ? {
                      action: () => onRestore(item),
                      text: 'Restore',
                      iconStart: <Icon data={ArrowRotateLeft} />,
                      theme: 'normal' as const,
                    }
                  : {
                      action: () => onDelete(item),
                      text: 'Delete',
                      iconStart: <Icon data={TrashBin} />,
                      theme: 'danger' as const,
                    },
              ],
            ]}
            renderSwitcher={(props) => (
              <Button {...props} view="flat" size="s">
                <Icon data={Ellipsis} />
              </Button>
            )}
          />
        ),
        width: 60,
      },
    ],
    [
      selectedIds,
      isAllSelected,
      isSomeSelected,
      onSelectionChange,
      onSelectAll,
      onClearSelection,
      onEdit,
      onDelete,
      onRestore,
      onPreview,
    ]
  );

  return (
    <div className="modal-table">
      {/* Toolbar */}
      <div className="modal-table__toolbar">
        <div className="modal-table__toolbar-left">
          <TextInput
            placeholder="Search modals..."
            value={filters.search || ''}
            onUpdate={(value) => onFiltersChange({ search: value || undefined })}
            hasClear
            className="modal-table__search"
          />
          <Button
            view={showFilters ? 'normal' : 'flat'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon data={Funnel} />
            Filters
          </Button>
        </div>

        <div className="modal-table__toolbar-right">
          {selectedIds.length > 0 && (
            <div className="modal-table__bulk-actions">
              <span className="modal-table__selected-count">
                {selectedIds.length} selected
              </span>
              <Button
                view="flat"
                onClick={() => handleBulkAction('activate')}
                loading={isBulkActioning}
              >
                <Icon data={CirclePlay} />
                Activate
              </Button>
              <Button
                view="flat"
                onClick={() => handleBulkAction('deactivate')}
                loading={isBulkActioning}
              >
                <Icon data={CirclePause} />
                Deactivate
              </Button>
              <Button
                view="flat-danger"
                onClick={() => handleBulkAction('delete')}
                loading={isBulkActioning}
              >
                <Icon data={TrashBin} />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="modal-table__filters">
          <Select
            placeholder="Modal Type"
            value={[filters.modalType || '']}
            options={MODAL_TYPE_OPTIONS}
            onUpdate={([value]) =>
              onFiltersChange({
                modalType: value ? (value as ModalType) : undefined,
              })
            }
            width={150}
          />
          <Select
            placeholder="Status"
            value={[
              filters.isActive === undefined
                ? ''
                : filters.isActive
                  ? 'active'
                  : 'inactive',
            ]}
            options={STATUS_OPTIONS}
            onUpdate={([value]) =>
              onFiltersChange({
                isActive:
                  value === '' ? undefined : value === 'active',
              })
            }
            width={150}
          />
          <Checkbox
            checked={filters.includeDeleted || false}
            onUpdate={(checked) => onFiltersChange({ includeDeleted: checked })}
          >
            Include deleted
          </Checkbox>
          <Button
            view="flat"
            onClick={() =>
              onFiltersChange({
                search: undefined,
                modalType: undefined,
                isActive: undefined,
                includeDeleted: false,
              })
            }
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="modal-table__loading">
          <Loader size="l" />
        </div>
      ) : modals.length === 0 ? (
        <div className="modal-table__empty">
          <p>No modals found</p>
          {(filters.search || filters.modalType || filters.isActive !== undefined) && (
            <Button view="action" onClick={() => onFiltersChange({})}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <Table
          data={modals}
          columns={columns}
          getRowClassNames={(item) =>
            item.deleted_at ? ['modal-table__row--deleted'] : []
          }
        />
      )}
    </div>
  );
}
