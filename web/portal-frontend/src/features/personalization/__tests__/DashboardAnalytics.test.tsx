import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardAnalytics } from '../components/dashboard/DashboardAnalytics';
import { useAnalyticsReport } from '../hooks/useAnalytics';

vi.mock('../hooks/useAnalytics', () => ({
  useAnalyticsReport: vi.fn(),
}));

describe('DashboardAnalytics', () => {
  it('shows an inline unavailable state when analytics access is forbidden', () => {
    vi.mocked(useAnalyticsReport).mockReturnValue({
      report: undefined,
      isLoading: false,
      error: null,
      isForbidden: true,
      refetch: vi.fn(),
    });

    render(<DashboardAnalytics />);

    expect(screen.getByText('Content Analytics (30 days)')).toBeInTheDocument();
    expect(screen.getByText('Analytics are unavailable for this account.')).toBeInTheDocument();
  });
});
