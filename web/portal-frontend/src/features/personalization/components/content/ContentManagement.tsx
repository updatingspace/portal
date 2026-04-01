/**
 * Content Management Panel - Main admin UI for modals management
 */
import {
  Button,
  Icon,
  Modal,
  RadioGroup,
  Text,
  useToaster,
} from '@gravity-ui/uikit';
import { Plus, LayoutList, Calendar } from '@gravity-ui/icons';
import { useCallback, useState } from 'react';
import { ModalTable } from './ModalTable';
import { ModalEditor } from './ModalEditor';
import { ModalPreview } from './ModalPreview';
import { CalendarView } from './CalendarView';
import { PreviewModeToggle, PreviewOverlay, usePreviewMode } from './PreviewMode';
import { useModals, useModalSelection } from '../../hooks/useModals';
import type { HomePageModal, HomePageModalInput } from '../../types';
import './ContentManagement.css';

type ViewMode = 'table' | 'calendar';

export function ContentManagement() {
  const { add: addToast } = useToaster();
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Preview mode
  const {
    isEnabled: previewEnabled,
    showOverlay: showPreviewOverlay,
    togglePreviewMode,
    closeOverlay: closePreviewOverlay,
  } = usePreviewMode();
  
  const {
    modals,
    filters,
    isLoading,
    isCreating,
    isUpdating,
    // isDeleting and isRestoring available but not used currently
    updateFilters,
    create,
    update,
    remove,
    restore,
    bulkAction,
  } = useModals();

  const {
    selectedIds,
    // isSelected available for individual checks
    isAllSelected,
    isSomeSelected,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useModalSelection(modals);

  // Modal editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModal, setEditingModal] = useState<HomePageModal | null>(null);

  // Preview state
  const [previewModal, setPreviewModal] = useState<HomePageModal | null>(null);

  // Open editor for new modal
  const handleCreate = useCallback(() => {
    setEditingModal(null);
    setEditorOpen(true);
  }, []);

  // Open editor for existing modal
  const handleEdit = useCallback((modal: HomePageModal) => {
    setEditingModal(modal);
    setEditorOpen(true);
  }, []);

  // Close editor
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingModal(null);
  }, []);

  // Save modal (create or update)
  const handleSave = useCallback(
    async (data: HomePageModalInput) => {
      try {
        if (editingModal) {
          await update(editingModal.id, data);
          addToast({
            name: 'modal-updated',
            title: 'Modal updated',
            theme: 'success',
            autoHiding: 3000,
          });
        } else {
          await create(data);
          addToast({
            name: 'modal-created',
            title: 'Modal created',
            theme: 'success',
            autoHiding: 3000,
          });
        }
        handleCloseEditor();
      } catch {
        addToast({
          name: 'modal-error',
          title: 'Error saving modal',
          content: error instanceof Error ? error.message : 'Unknown error',
          theme: 'danger',
          autoHiding: 5000,
        });
      }
    },
    [editingModal, create, update, handleCloseEditor, addToast]
  );

  // Delete modal
  const handleDelete = useCallback(
    async (modal: HomePageModal) => {
      try {
        await remove(modal.id);
        addToast({
          name: 'modal-deleted',
          title: 'Modal deleted',
          content: 'You can restore it from the trash',
          theme: 'success',
          autoHiding: 3000,
        });
      } catch {
        addToast({
          name: 'delete-error',
          title: 'Error deleting modal',
          theme: 'danger',
          autoHiding: 5000,
        });
      }
    },
    [remove, addToast]
  );

  // Restore modal
  const handleRestore = useCallback(
    async (modal: HomePageModal) => {
      try {
        await restore(modal.id);
        addToast({
          name: 'modal-restored',
          title: 'Modal restored',
          theme: 'success',
          autoHiding: 3000,
        });
      } catch {
        addToast({
          name: 'restore-error',
          title: 'Error restoring modal',
          theme: 'danger',
          autoHiding: 5000,
        });
      }
    },
    [restore, addToast]
  );

  // Preview modal
  const handlePreview = useCallback((modal: HomePageModal) => {
    setPreviewModal(modal);
  }, []);

  // Bulk action
  const handleBulkAction = useCallback(
    async (ids: number[], action: 'activate' | 'deactivate' | 'delete' | 'restore') => {
      try {
        const result = await bulkAction(ids, action);
        addToast({
          name: 'bulk-action',
          title: `${result.affected} modal(s) ${action}d`,
          theme: 'success',
          autoHiding: 3000,
        });
      } catch {
        addToast({
          name: 'bulk-error',
          title: 'Error performing bulk action',
          theme: 'danger',
          autoHiding: 5000,
        });
      }
    },
    [bulkAction, addToast]
  );

  return (
    <div className="content-management">
      {/* Header */}
      <div className="content-management__header">
        <div className="content-management__header-left">
          <Text variant="header-1">Homepage Modals</Text>
          <Text variant="body-1" color="secondary">
            Manage modal windows displayed to users
          </Text>
        </div>
        <div className="content-management__header-right">
          <PreviewModeToggle
            modals={modals}
            isEnabled={previewEnabled}
            onToggle={togglePreviewMode}
          />
          <Button view="action" onClick={handleCreate}>
            <Icon data={Plus} />
            Create Modal
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="content-management__toolbar">
        <RadioGroup value={viewMode} onUpdate={(v) => setViewMode(v as ViewMode)} direction="horizontal">
          <RadioGroup.Option value="table">
            <Icon data={LayoutList} size={14} />
            Table
          </RadioGroup.Option>
          <RadioGroup.Option value="calendar">
            <Icon data={Calendar} size={14} />
            Calendar
          </RadioGroup.Option>
        </RadioGroup>
      </div>

      {/* Content - Table or Calendar */}
      {viewMode === 'table' ? (
        <ModalTable
          modals={modals}
          isLoading={isLoading}
          filters={filters}
          onFiltersChange={updateFilters}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onPreview={handlePreview}
          onBulkAction={handleBulkAction}
          selectedIds={selectedIds}
          onSelectionChange={toggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          isAllSelected={isAllSelected}
          isSomeSelected={isSomeSelected}
        />
      ) : (
        <CalendarView
          modals={modals}
          onEdit={handleEdit}
          onPreview={handlePreview}
        />
      )}

      {/* Editor Modal */}
      <Modal
        open={editorOpen}
        onClose={handleCloseEditor}
        className="content-management__editor-modal"
      >
        <ModalEditor
          modal={editingModal}
          onSave={handleSave}
          onCancel={handleCloseEditor}
          isSaving={isCreating || isUpdating}
        />
      </Modal>

      {/* Preview Modal (single modal) */}
      {previewModal && (
        <div
          className="content-management__preview-overlay"
          onClick={() => setPreviewModal(null)}
        >
          <ModalPreview
            title={previewModal.title}
            content={previewModal.content}
            contentHtml={previewModal.content_html}
            buttonText={previewModal.button_text}
            buttonUrl={previewModal.button_url}
            modalType={previewModal.modal_type}
            fullscreen
            onClose={() => setPreviewModal(null)}
          />
        </div>
      )}

      {/* Preview Mode Overlay (all active modals) */}
      {showPreviewOverlay && (
        <PreviewOverlay
          modals={modals}
          onClose={closePreviewOverlay}
        />
      )}
    </div>
  );
}
