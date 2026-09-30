import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/test-utils';
import { CreatePostComposer } from './CreatePostComposer';

describe('publication draft', () => {
  it('preserves the text and displays an error when publication fails', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('Unavailable'));
    renderWithProviders(<CreatePostComposer canCreatePost onPublish={publish} />);
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Мой черновик'}});
    fireEvent.click(screen.getByRole('button', {name: /опубликовать/i}));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('textbox')).toHaveValue('Мой черновик');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('does not erase text written while a publication is being sent', async () => {
    let complete!: () => void;
    const publish = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    const published = vi.fn();
    renderWithProviders(<CreatePostComposer canCreatePost onPublish={publish} onPublished={published} />);
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Первый текст'}});
    fireEvent.click(screen.getByRole('button', {name: /опубликовать/i}));
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Следующий текст'}});
    complete();
    await waitFor(() => expect(screen.getByRole('button', {name: /опубликовать/i})).not.toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByRole('textbox')).toHaveValue('Следующий текст');
    expect(published).not.toHaveBeenCalled();
  });

  it('closes the task only after a confirmed publication with no newer draft', async () => {
    const published = vi.fn();
    renderWithProviders(<CreatePostComposer canCreatePost onPublish={vi.fn().mockResolvedValue(undefined)} onPublished={published} />);
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Готовая публикация'}});
    fireEvent.click(screen.getByRole('button', {name: /опубликовать/i}));
    await waitFor(() => expect(published).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
