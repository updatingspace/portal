import React from 'react';
import { describe, test } from 'vitest';

import { createSuperuserProfile } from '../test/fixtures';
import { serviceApiMock } from '../test/mocks/api';
import { renderWithProviders, screen, waitFor } from '../test/test-utils';
import ProfilePage from './ProfilePage';

describe('ProfilePage integration', () => {
  test('renders profile data and passkeys card for superuser', async () => {
    serviceApiMock.me.mockResolvedValue(createSuperuserProfile());

    renderWithProviders(<ProfilePage />, { route: '/profile' });

    expect(await screen.findByText(/root@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Root User/i)).toBeInTheDocument();
    expect(screen.queryByText(/Войти \/ зарегистрироваться/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Passkeys/i)).toBeInTheDocument();
    expect(screen.getByText(/Системный администратор/i)).toBeInTheDocument();
    expect(screen.getByText(/Администратор тенанта/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Открыть в ID/i })).toHaveAttribute(
      'href',
      'https://id.updspace.com/account',
    );
  });

  test('shows login button when profile load fails', async () => {
    serviceApiMock.me.mockRejectedValueOnce(new Error('fail'));

    renderWithProviders(<ProfilePage />, { route: '/profile' });

    await waitFor(() =>
      expect(serviceApiMock.me).toHaveBeenCalled(),
    );
    expect(await screen.findByRole('button', { name: /Войти \/ зарегистрироваться/i })).toBeInTheDocument();
  });
});
