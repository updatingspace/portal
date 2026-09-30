import React from 'react';
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import {I18nProvider} from '../../../app/providers/I18nProvider';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import { vi } from 'vitest';

import { EventForm } from './EventForm';
const render=(ui:React.ReactElement)=>rtlRender(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><I18nProvider>{ui}</I18nProvider></QueryClientProvider>);
const create=vi.fn();
beforeEach(()=>{localStorage.setItem('portal_locale_v1','ru');sessionStorage.clear();create.mockClear();});

vi.mock('@gravity-ui/uikit', () => ({
  Button: ({ ...props }: React.ComponentProps<'button'> & { loading?: boolean; view?: string; size?: string }) => (
    <button {...props} />
  ),
  Card: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Select: ({ ...props }: React.ComponentProps<'div'> & { onUpdate?: () => void; value?: unknown }) => (
    <div {...props} />
  ),
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
  useCreateEvent: () => ({ isPending: false, mutate: create }),
  useUpdateEvent: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe('EventForm', () => {
  it('renders create form layout', () => {
    render(<EventForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getAllByText('Создать событие').length).toBeGreaterThan(0);
    expect(screen.getByText('Предпросмотр')).toBeInTheDocument();
  });
  it('keeps the draft after a failed save and prevents duplicate submissions',async()=>{
    render(<EventForm onSuccess={vi.fn()} onCancel={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Новая встреча'}});
    fireEvent.click(screen.getByRole('button',{name:'Создать событие'}));
    await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button',{name:'Создать событие'}));
    expect(create).toHaveBeenCalledTimes(1);
    await act(async()=>create.mock.calls[0][1].onError(new Error('Не удалось сохранить')));
    expect(screen.getByLabelText('Название')).toHaveValue('Новая встреча');
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
