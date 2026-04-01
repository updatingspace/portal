import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModalPreview } from '../components/content/ModalPreview';
import { PreviewModeToggle } from '../components/content/PreviewMode';
import { ContentManagement } from '../components/content/ContentManagement';
import type { HomePageModal } from '../types';

vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');
  return {
    ...actual,
    useToaster: () => ({ add: vi.fn() }),
    RadioGroup: Object.assign(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      { Option: ({ children }: { children: React.ReactNode }) => <label>{children}</label> }
    ),
  };
});

const nowIso = new Date().toISOString();

const baseModal: HomePageModal = {
  id: 1,
  title: 'Test modal',
  content: 'Body',
  content_html: '<p>Body</p>',
  button_text: 'Open',
  button_url: '',
  modal_type: 'promo',
  is_active: true,
  display_once: false,
  start_date: nowIso,
  end_date: null,
  order: 1,
  translations: {},
  version: 1,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: nowIso,
  updated_at: nowIso,
};

vi.mock('../hooks/useModals', () => ({
  useModals: () => ({
    modals: [baseModal],
    filters: {},
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    updateFilters: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    bulkAction: vi.fn().mockResolvedValue({ affected: 1 }),
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
  ModalTable: () => <div data-testid="modal-table">ModalTable</div>,
}));

vi.mock('../components/content/CalendarView', () => ({
  CalendarView: () => <div data-testid="calendar-view">CalendarView</div>,
}));

vi.mock('../components/content/ModalEditor', () => ({
  ModalEditor: () => <div data-testid="modal-editor">ModalEditor</div>,
}));

vi.mock('../components/content/PreviewMode', async () => {
  const actual = await vi.importActual<typeof import('../components/content/PreviewMode')>(
    '../components/content/PreviewMode'
  );

  return {
    ...actual,
    PreviewOverlay: () => <div data-testid="preview-overlay">PreviewOverlay</div>,
    usePreviewMode: () => ({
      isEnabled: false,
      selectedUserId: null,
      showOverlay: false,
      togglePreviewMode: vi.fn(),
      closeOverlay: vi.fn(),
      selectUser: vi.fn(),
    }),
  };
});

describe('Content management UI', () => {
  it('calls dismiss handlers from ModalPreview', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ModalPreview
        title="Hello"
        content="World"
        buttonText="OK"
        modalType="promo"
        onClose={onClose}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows active modal count in PreviewModeToggle', () => {
    render(
      <PreviewModeToggle
        modals={[baseModal]}
        isEnabled
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('1 modal active')).toBeInTheDocument();
  });

  it('renders content management with default table view', () => {
    render(<ContentManagement />);
    expect(screen.getByTestId('modal-table')).toBeInTheDocument();
    expect(screen.getByText('Create Modal')).toBeInTheDocument();
  });
});
