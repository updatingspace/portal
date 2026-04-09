import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PersonalizationSection } from './PersonalizationSection';

vi.mock('../../../features/personalization', () => ({
  DashboardAnalytics: () => <div>Dashboard Analytics</div>,
}));

vi.mock('@/shared/hooks/useFormatters', () => ({
  useFormatters: () => ({
    formatDateTime: (value: string | Date | null | undefined) =>
      value ? 'formatted-date' : '—',
  }),
}));

const baseProps = {
  modals: [],
  isLoading: false,
  error: null,
  selectedModalId: null,
  onSelectModal: vi.fn(),
  onCreateModal: vi.fn(),
  onEditModal: vi.fn(),
  onDeleteModal: vi.fn(),
};

describe('Admin PersonalizationSection', () => {
  it('renders analytics only when the caller enables it', () => {
    const { rerender } = render(<PersonalizationSection {...baseProps} />);

    expect(screen.queryByText('Dashboard Analytics')).not.toBeInTheDocument();

    rerender(<PersonalizationSection {...baseProps} showAnalytics />);

    expect(screen.getByText('Dashboard Analytics')).toBeInTheDocument();
  });
});
