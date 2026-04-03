import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AccessDeniedError } from '../../api/accessDenied';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuthInitializer } from '../../test/test-utils';
import { toaster } from '../../toaster';
import { AccessDeniedScreen } from './AccessDeniedScreen';

const BASE_USER = {
  id: 'u-1',
  username: 'u-1',
  email: 'u-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User 1',
  tenant: { id: 'tenant-1', slug: 'aef' },
};

const createAccessDeniedError = (reason: string, requestId: string) =>
  new AccessDeniedError({
    source: 'api',
    reason,
    requestId,
    service: 'voting',
    path: '/app/voting/42',
  });

const renderAccessDeniedScreen = (error: AccessDeniedError, user = BASE_USER) => {
  render(
    <MemoryRouter initialEntries={['/app/voting/42']}>
      <AuthProvider bootstrap={false}>
        <AuthInitializer user={user} />
        <AccessDeniedScreen error={error} />
      </AuthProvider>
    </MemoryRouter>,
  );
};

describe('AccessDeniedScreen', () => {
  it('copies admin message template with request id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(toaster, 'add').mockImplementation(() => undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    document.title = 'Voting Campaign';

    renderAccessDeniedScreen(createAccessDeniedError('Доступ запрещён политикой tenant-а', 'req-123'));

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать сообщение администратору' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(writeText).toHaveBeenCalledWith(
      "Здравствуйте! У меня нет доступа к разделу: Voting Campaign.\nПожалуйста, проверьте права в tenant'е и выдайте доступ.\nRequest ID: req-123",
    );
  });

  it('shows sanitized technical details for regular denial reason', async () => {
    renderAccessDeniedScreen(createAccessDeniedError('Доступ запрещён политикой tenant-а', 'req-123'));

    fireEvent.click(screen.getByText('Технические детали'));
    expect(screen.getByText('Причина: Доступ запрещён политикой tenant-а')).toBeInTheDocument();
    expect(screen.getByText(/Tenant: aef · tenant-1/)).toBeInTheDocument();
  });

  it('shows success toast after copying admin template', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const addToast = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    renderAccessDeniedScreen(createAccessDeniedError('Доступ запрещён политикой tenant-а', 'req-123'));

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать сообщение администратору' }));

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Скопировано',
        }),
      );
    });
  });

  it('does not render debug-like reason in technical details', () => {
    renderAccessDeniedScreen(
      createAccessDeniedError(
        'Traceback (most recent call last): RuntimeError: forbidden',
        'req-debug',
      ),
      {
        ...BASE_USER,
        id: 'u-2',
        username: 'u-2',
        email: 'u-2@example.com',
        displayName: 'User 2',
      },
    );

    fireEvent.click(screen.getByText('Технические детали'));
    expect(screen.queryByText(/Причина:/)).not.toBeInTheDocument();
  });
});
