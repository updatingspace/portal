import {TenantProvider} from '../../../contexts/TenantContext';
import {I18nProvider} from '../../../app/providers/I18nProvider';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { EventPage } from './EventPage';

vi.mock('@gravity-ui/uikit', () => ({
  DropdownMenu: ({items}: {items:{text:string;action:()=>void}[]}) => <div>{items.map(item=><button key={item.text} onClick={item.action}>{item.text}</button>)}</div>,
  Button: ({ selected, ...props }: React.ComponentProps<'button'> & { loading?: boolean; selected?:boolean }) => <button aria-pressed={selected} {...props} />,
  Card: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Text: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Icon: () => <span data-testid="icon" />,
  Label: (props: React.ComponentProps<'span'>) => <span {...props} />,
  Loader: () => <div data-testid="loader" />,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      tenant: { id: 'tenant-1', slug: 'aef' },
      language: 'ru',
      isSuperuser: false,
      capabilities: ['events.event.manage', 'events.rsvp.set'],
      roles: [],
    },
  }),
}));

const mockMutate = vi.fn();
const mockRefetch = vi.fn(async()=>({isError:false}));

vi.mock('../../../features/events', () => ({
  useEvent: () => ({
    data: {
      id: 'event-1',
      tenantId: 'tenant-1',
      scopeType: 'TENANT',
      scopeId: 'tenant-1',
      title: 'Community Meetup',
      description: 'Meet and play',
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      locationText: 'Discord',
      locationUrl: 'https://discord.gg/test',
      gameId: null,
      visibility: 'public',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      rsvpCounts: { going: 4, interested: 1, not_going: 0 },
      myRsvp: 'going',
    },
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
  }),
  useSetRsvp: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useExportEventAsIcs: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock('../../../features/rbac/can', () => ({
  can: () => true,
}));

vi.mock('../../../utils/apiErrorHandling', () => ({
  notifyApiError: vi.fn(),
}));

vi.mock('../../../toaster', () => ({
  toaster: { add: vi.fn() },
}));

describe('EventPage', () => {
  it('renders event details and RSVP actions', () => {
    localStorage.setItem('portal_locale_v1','ru');
    render(
      <MemoryRouter initialEntries={['/app/events/event-1']}><I18nProvider>
        <Routes>
          <Route path="/app/events/:id" element={<TenantProvider><EventPage /></TenantProvider>} />
        </Routes>
      </I18nProvider></MemoryRouter>,
    );

    expect(screen.getByText('Community Meetup')).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Мой ответ'})).toBeInTheDocument();
    expect(screen.getByText('Пойду')).toBeInTheDocument();
    expect(screen.getByText('Интересно')).toBeInTheDocument();
    expect(screen.getByText('Не пойду')).toBeInTheDocument();
  });

  it('preserves the confirmed response on failure and reconciles before another write',async()=>{
    localStorage.setItem('portal_locale_v1','ru');
    mockMutate.mockClear();mockRefetch.mockClear();
    render(<MemoryRouter initialEntries={['/app/events/event-1']}><I18nProvider><Routes><Route path="/app/events/:id" element={<TenantProvider><EventPage/></TenantProvider>}/></Routes></I18nProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Не пойду'}));
    fireEvent.click(screen.getByRole('button',{name:'Интересно'}));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    await act(async()=>{await mockMutate.mock.calls[0][1].onError(new Error('offline'));});
    await waitFor(()=>expect(mockRefetch).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось подтвердить');
    expect(screen.getByRole('button',{name:'Пойду'})).toHaveAttribute('aria-pressed','true');
  });
});
