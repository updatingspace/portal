import React, { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AccessDeniedError } from '../../api/accessDenied';
import { AuthProvider, type UserInfo, useAuth } from '../../contexts/AuthContext';
import { toaster } from '../../toaster';
import { AccessDeniedScreen } from './AccessDeniedScreen';

const AuthInitializer: React.FC<{ user: UserInfo | null }> = ({ user }) => {
  const { setUser } = useAuth();

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return null;
};

describe('AccessDeniedScreen', () => {
  it('copies admin message template with request id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const addToast = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    document.title = 'Voting Campaign';

    render(
      <MemoryRouter initialEntries={['/app/voting/42']}>
        <AuthProvider bootstrap={false}>
          <AuthInitializer
            user={{
              id: 'u-1',
              username: 'u-1',
              email: 'u-1@example.com',
              isSuperuser: false,
              isStaff: false,
              displayName: 'User 1',
              tenant: { id: 'tenant-1', slug: 'aef' },
            }}
          />
          <AccessDeniedScreen
            error={new AccessDeniedError({
              source: 'api',
              reason: 'Доступ запрещён политикой tenant-а',
              requestId: 'req-123',
              service: 'voting',
              path: '/app/voting/42',
            })}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать сообщение администратору' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(writeText).toHaveBeenCalledWith(
      "Здравствуйте! У меня нет доступа к разделу: Voting Campaign.\nПожалуйста, проверьте права в tenant'е и выдайте доступ.\nRequest ID: req-123",
    );

    fireEvent.click(screen.getByText('Технические детали'));
    expect(screen.getByText('Причина: Доступ запрещён политикой tenant-а')).toBeInTheDocument();
    expect(screen.getByText(/Tenant: aef · tenant-1/)).toBeInTheDocument();

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Скопировано',
        }),
      );
    });

    addToast.mockRestore();
  });

  it('does not render debug-like reason in technical details', () => {
    render(
      <MemoryRouter initialEntries={['/app/voting/42']}>
        <AuthProvider bootstrap={false}>
          <AuthInitializer
            user={{
              id: 'u-2',
              username: 'u-2',
              email: 'u-2@example.com',
              isSuperuser: false,
              isStaff: false,
              displayName: 'User 2',
              tenant: { id: 'tenant-1', slug: 'aef' },
            }}
          />
          <AccessDeniedScreen
            error={new AccessDeniedError({
              source: 'api',
              reason: 'Traceback (most recent call last): RuntimeError: forbidden',
              requestId: 'req-debug',
              service: 'voting',
              path: '/app/voting/42',
            })}
          />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Технические детали'));
    expect(screen.queryByText(/Причина:/)).not.toBeInTheDocument();
  });
});
