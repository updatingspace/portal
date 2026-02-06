import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccessDeniedView } from './AccessDeniedView';

describe('AccessDeniedView', () => {
  it('renders fixed minimal copy and hides raw upstream strings', () => {
    const onHome = vi.fn();

    render(
      <AccessDeniedView
        tenant={{ id: 'tenant-1', slug: 'aef' }}
        requestId="req-42"
        service="voting"
        onHome={onHome}
        onCopyAdminMessage={vi.fn()}
        onCopyRequestId={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Доступ ограничен' })).toBeInTheDocument();
    expect(screen.getByText('У вашего аккаунта пока нет прав для просмотра этого раздела.')).toBeInTheDocument();
    expect(screen.getByText("Попросите администратора tenant'а выдать доступ. Request ID поможет быстрее разобраться.")).toBeInTheDocument();
    expect(screen.queryByText(/upstream returned error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/runtime error/i)).not.toBeInTheDocument();
  });

  it('shows tenant with uuid and reason summary in technical details without HTTP status line', () => {
    render(
      <AccessDeniedView
        tenant={{ id: '7cbf2b8c-58f3-4ef2-8b14-cdd7e1b0436d', slug: 'aef' }}
        requestId="req-88"
        reasonSummary="Недостаточно прав для role portal.viewer"
        onHome={vi.fn()}
        onCopyAdminMessage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Технические детали'));

    expect(screen.getByText('Tenant: aef · 7cbf2b8c-58f3-4ef2-8b14-cdd7e1b0436d')).toBeInTheDocument();
    expect(screen.getByText('Причина: Недостаточно прав для role portal.viewer')).toBeInTheDocument();
    expect(screen.queryByText('HTTP status: 403')).not.toBeInTheDocument();
  });

  it('shows request id in bottom area and copies by button click', () => {
    const onCopyRequestId = vi.fn();

    render(
      <AccessDeniedView
        requestId="req-77"
        onHome={vi.fn()}
        onCopyAdminMessage={vi.fn()}
        onCopyRequestId={onCopyRequestId}
      />,
    );

    expect(screen.getAllByText('Request ID: req-77').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать Request ID снизу' }));
    expect(onCopyRequestId).toHaveBeenCalledTimes(1);
  });

  it('hides request id footer when request id is missing', () => {
    render(
      <AccessDeniedView
        onHome={vi.fn()}
        onCopyAdminMessage={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Request ID:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Скопировать Request ID/i })).not.toBeInTheDocument();
  });

  it('has actions including copy message for admin', () => {
    const onCopyAdminMessage = vi.fn();

    render(
      <AccessDeniedView
        onHome={vi.fn()}
        onBack={vi.fn()}
        showBackAction
        onCopyAdminMessage={onCopyAdminMessage}
      />,
    );

    expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать сообщение администратору' }));
    expect(onCopyAdminMessage).toHaveBeenCalledTimes(1);
  });
});
