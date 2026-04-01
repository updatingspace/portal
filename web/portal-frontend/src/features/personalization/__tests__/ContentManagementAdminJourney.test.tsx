import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContentManagement } from '../components/content/ContentManagement';
import type { HomePageModal, HomePageModalInput } from '../types';

const createMock = vi.fn<(_: HomePageModalInput) => Promise<unknown>>();
const updateMock = vi.fn();
const removeMock = vi.fn();
const restoreMock = vi.fn();
const bulkActionMock = vi.fn();

const modalFixture: HomePageModal = {
  id: 10,
  title: 'Existing modal',
  content: 'Existing content',
  content_html: '<p>Existing content</p>',
  button_text: 'Open',
  button_url: '',
  modal_type: 'info',
  is_active: true,
  display_once: false,
  start_date: null,
  end_date: null,
  order: 1,
  translations: {},
  version: 1,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');
  return {
    ...actual,
    useToaster: () => ({ add: vi.fn() }),
    Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="modal">{children}</div> : null,
    RadioGroup: Object.assign(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      { Option: ({ children }: { children: React.ReactNode }) => <label>{children}</label> }
    ),
  };
});

vi.mock('../hooks/useModals', () => ({
  useModals: () => ({
    modals: [modalFixture],
    filters: {},
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    updateFilters: vi.fn(),
    create: createMock,
    update: updateMock,
    remove: removeMock,
    restore: restoreMock,
    bulkAction: bulkActionMock,
  }),
  useModalSelection: () => ({
    selectedIds: [],
    isAllSelected: false,
    isSomeSelected: false,
    toggleSelection: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('../components/content/ModalTable', () => ({
  ModalTable: ({ onPreview }: { onPreview: (m: HomePageModal) => void }) => (
    <div data-testid="modal-table">
      <button onClick={() => onPreview(modalFixture)}>Preview existing modal</button>
    </div>
  ),
}));

vi.mock('../components/content/ModalEditor', () => ({
  ModalEditor: ({ onSave }: { onSave: (data: HomePageModalInput) => Promise<void> }) => (
    <div data-testid="modal-editor">
      <button
        onClick={() =>
          onSave({
            title: 'New modal',
            content: 'Admin journey content',
            modal_type: 'info',
            is_active: true,
          })
        }
      >
        Save modal
      </button>
    </div>
  ),
}));

vi.mock('../components/content/CalendarView', () => ({
  CalendarView: () => <div data-testid="calendar-view">CalendarView</div>,
}));

describe('ContentManagement admin journey', () => {
  it('creates and previews modal in admin flow', async () => {
    createMock.mockResolvedValueOnce({ id: 999 });

    render(<ContentManagement />);

    fireEvent.click(screen.getByText('Create Modal'));
    expect(screen.getByTestId('modal-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save modal'));
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('Preview existing modal'));
    expect(screen.getByText('Existing modal')).toBeInTheDocument();
  });
});
