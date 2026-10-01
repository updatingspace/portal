import { useState } from 'react';
import { it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScopePicker } from './ScopePicker';
import type { ScopeType } from '../api';
import { request } from '../../../api/client';
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u', tenant: { id: 'tenant-a', slug: 'alpha' } },
  }),
}));
vi.mock('../../../api/client', () => ({ request: vi.fn() }));
vi.mock('@gravity-ui/uikit', async (original) => ({
  ...(await original<typeof import('@gravity-ui/uikit')>()),
  Select: ({
    id,
    value,
    onUpdate,
    options,
    disabled,
  }: {
    id: string;
    value: string[];
    onUpdate: (v: string[]) => void;
    options: Array<{ value: string; content: string }>;
    disabled?: boolean;
  }) => (
    <select
      id={id}
      value={value[0] || ''}
      onChange={(e) => onUpdate([e.target.value])}
      disabled={disabled}
    >
      <option value="" />
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.content}
        </option>
      ))}
    </select>
  ),
}));
it('selects named scopes and clears a previous scope when the type changes', async () => {
  vi.mocked(request).mockResolvedValue([
    { id: 'group-a', name: 'Minecraft players' },
  ]);
  const changed = vi.fn();
  function Form() {
    const [value, set] = useState<{ type: ScopeType; id: string }>({
      type: 'TENANT',
      id: 'tenant-a',
    });
    return (
      <ScopePicker
        {...value}
        onChange={(type, id) => {
          changed(type, id);
          set({ type, id });
        }}
      />
    );
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Form />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Где действует роль'), {
    target: { value: 'COMMUNITY' },
  });
  expect(changed).toHaveBeenLastCalledWith('COMMUNITY', '');
  await screen.findByRole('option', { name: 'Minecraft players' });
  fireEvent.change(screen.getByLabelText('Группа'), {
    target: { value: 'group-a' },
  });
  expect(changed).toHaveBeenLastCalledWith('COMMUNITY', 'group-a');
  fireEvent.change(screen.getByLabelText('Где действует роль'), {
    target: { value: 'TENANT' },
  });
  expect(changed).toHaveBeenLastCalledWith('TENANT', 'tenant-a');
});
