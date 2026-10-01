import type { ReactNode } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@gravity-ui/uikit';
import { I18nProvider } from '../../../app/providers/I18nProvider';
import { PostModerationDialog } from './PostModerationDialog';
import { deleteNews, fetchPostAudit } from '../../../api/activity';
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'moderator', tenant: { id: 'alpha' } } }),
}));
vi.mock('../../../api/activity', () => ({
  deleteNews: vi.fn(),
  fetchPostAudit: vi.fn(),
}));
vi.mock('../../../shared/ui/portal/ContentDialog', () => ({
  ContentDialog: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
  }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
const close = vi.fn(),
  removed = vi.fn();
function setup() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ThemeProvider theme="dark">
        <I18nProvider>
          <PostModerationDialog
            newsId="post-1"
            title="Community news"
            onClose={close}
            onRemoved={removed}
          />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('portal_locale_v1', 'en');
  vi.mocked(fetchPostAudit).mockResolvedValue({ items: [] });
});
describe('Post moderation', () => {
  it('loads history for the selected post and requires a reason', async () => {
    setup();
    await screen.findByText('No changes recorded yet.');
    expect(fetchPostAudit).toHaveBeenCalledWith('post-1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove post…' }));
    expect(
      screen.getByRole('button', { name: 'Remove post', exact: true }),
    ).toBeDisabled();
    expect(deleteNews).not.toHaveBeenCalled();
  });
  it('preserves the reason on failure and only closes after confirmed success', async () => {
    vi.mocked(deleteNews)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(undefined);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove post…' }));
    fireEvent.change(screen.getByLabelText('Reason for removal'), {
      target: { value: 'Spam' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove post', exact: true }),
    );
    await screen.findByText(
      'Unable to remove the post. Your reason is still here.',
    );
    expect(screen.getByLabelText('Reason for removal')).toHaveValue('Spam');
    expect(close).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove post', exact: true }),
    );
    await vi.waitFor(() => expect(removed).toHaveBeenCalledOnce());
    expect(deleteNews).toHaveBeenLastCalledWith('post-1', 'Spam');
  });
  it('keeps removal available when only history fails', async () => {
    vi.mocked(fetchPostAudit).mockRejectedValue(new Error('Unavailable'));
    setup();
    await screen.findByText('Unable to load history.');
    expect(screen.getByRole('button', { name: 'Remove post…' })).toBeEnabled();
  });
});
