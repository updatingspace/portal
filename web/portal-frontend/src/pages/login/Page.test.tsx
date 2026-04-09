import React from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { LoginPage } from './Page';

describe('LoginPage', () => {
  it('shows friendly auth error from query params', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/login?next=%2Fchoose-tenant&auth_error=INVALID_STATE&request_id=req-123',
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Не удалось завершить вход'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Сессия входа истекла или уже была использована. Попробуйте войти снова.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Request ID: req-123')).toBeInTheDocument();
  });
});
