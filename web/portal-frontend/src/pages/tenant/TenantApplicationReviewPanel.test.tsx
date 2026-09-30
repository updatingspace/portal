import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTenantApplicationsForReview, reviewTenantApplication } from '../../api/tenant';
import { TenantApplicationReviewPanel } from './TenantApplicationReviewPanel';

vi.mock('../../api/tenant', () => ({
  fetchTenantApplicationsForReview: vi.fn(),
  reviewTenantApplication: vi.fn(),
}));

const application = {
  id: 'app-1', tenant_id: 'tenant-1', applicant_user_id: 'user-1',
  slug: 'friends', name: 'Friends', description: 'Our community', status: 'pending',
};

function mount() {
  const onReviewed = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <TenantApplicationReviewPanel onReviewed={onReviewed} />
  </QueryClientProvider>);
  return onReviewed;
}

beforeEach(() => vi.resetAllMocks());

describe('TenantApplicationReviewPanel', () => {
  it.each(['approve', 'reject'] as const)('submits %s and reloads the queue', async decision => {
    vi.mocked(fetchTenantApplicationsForReview).mockResolvedValueOnce([application]).mockResolvedValue([]);
    vi.mocked(reviewTenantApplication).mockResolvedValue({ ...application, status: decision === 'approve' ? 'approved' : 'rejected' });
    const onReviewed = mount();
    await userEvent.click(await screen.findByRole('button', { name: decision === 'approve' ? 'Одобрить' : 'Отклонить' }));
    await waitFor(() => expect(reviewTenantApplication).toHaveBeenCalledWith('app-1', decision));
    await screen.findByText('Нет заявок на рассмотрении.');
    expect(onReviewed).toHaveBeenCalledOnce();
  });

  it('allows retrying provisioning without showing reject', async () => {
    vi.mocked(fetchTenantApplicationsForReview).mockResolvedValue([{ ...application, status: 'provisioning' }]);
    vi.mocked(reviewTenantApplication).mockRejectedValue(new Error('Unavailable'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить настройку доступа' }));
    expect(screen.queryByRole('button', { name: 'Отклонить' })).not.toBeInTheDocument();
    await screen.findByRole('alert');
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
