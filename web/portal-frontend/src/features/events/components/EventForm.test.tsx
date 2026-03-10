import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { EventForm } from './EventForm';

vi.mock('@gravity-ui/uikit', () => ({
  Button: (props: React.ComponentProps<'button'> & { loading?: boolean; view?: string; size?: string }) => (
    <button {...props} />
  ),
  Card: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Select: (props: React.ComponentProps<'div'> & { onUpdate?: () => void; value?: unknown }) => <div {...props} />,
  Text: (props: React.ComponentProps<'div'>) => <div {...props} />,
  TextArea: ({ value, onUpdate, ...rest }: { value?: string; onUpdate?: (value: string) => void } & React.ComponentProps<'textarea'>) => (
    <textarea
      value={value}
      onChange={(event) => onUpdate?.(event.target.value)}
      {...rest}
    />
  ),
  TextInput: ({ value, onUpdate, ...rest }: { value?: string; onUpdate?: (value: string) => void } & React.ComponentProps<'input'>) => (
    <input value={value} onChange={(event) => onUpdate?.(event.target.value)} {...rest} />
  ),
}));

vi.mock('@gravity-ui/date-utils', () => ({
  settings: { loadLocale: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      tenant: { id: 'tenant-1', slug: 'aef' },
      language: 'ru',
    },
  }),
}));

vi.mock('../hooks', () => ({
  useCreateEvent: () => ({ isPending: false, mutate: vi.fn() }),
  useUpdateEvent: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe('EventForm', () => {
  it('renders create form layout', () => {
    render(<EventForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getAllByText('Создать событие').length).toBeGreaterThan(0);
    expect(screen.getByText('Предпросмотр')).toBeInTheDocument();
  });
});
