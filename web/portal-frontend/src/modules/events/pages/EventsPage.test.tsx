import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { EventsPage } from './EventsPage';

vi.mock('@gravity-ui/uikit', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Card: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Text: (props: React.ComponentProps<'div'>) => <div {...props} />,
  Icon: () => <span data-testid="icon" />,
  Label: (props: React.ComponentProps<'span'>) => <span {...props} />,
  Loader: () => <div data-testid="loader" />,
  Pagination: (props: React.ComponentProps<'div'>) => <div data-testid="pagination" {...props} />,
  Select: ({ onUpdate, value, ...rest }: { onUpdate?: () => void; value?: unknown } & React.ComponentProps<'div'>) => (
    <div {...rest} />
  ),
  TextInput: ({ value, onUpdate, ...rest }: { value?: string; onUpdate?: (value: string) => void } & React.ComponentProps<'input'>) => (
    <input
      value={value}
      onChange={(event) => onUpdate?.(event.target.value)}
      {...rest}
    />
  ),
}));

vi.mock('@gravity-ui/date-components', () => ({
  Calendar: ({ onUpdate, value, ...props }: React.ComponentProps<'div'> & { onUpdate?: () => void; value?: unknown }) => (
    <div data-testid="calendar" {...props} />
  ),
}));

vi.mock('@gravity-ui/date-utils', () => ({
  dateTime: ({ input }: { input: Date }) => input,
  settings: { loadLocale: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      tenant: { id: 'tenant-1', slug: 'aef' },
      language: 'ru',
      isSuperuser: false,
      capabilities: ['events.event.create', 'events.event.manage'],
      roles: [],
    },
  }),
}));

vi.mock('../../../features/events', () => ({
  useEventsList: () => ({
    data: {
      items: [
        {
          id: 'event-1',
          tenantId: 'tenant-1',
          scopeType: 'TENANT',
          scopeId: 'tenant-1',
          title: 'Raid Night',
          description: 'Weekly raid session',
          startsAt: new Date(Date.now() + 3600_000).toISOString(),
          endsAt: new Date(Date.now() + 7200_000).toISOString(),
          locationText: 'Discord',
          locationUrl: 'https://discord.gg/test',
          gameId: null,
          visibility: 'public',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          rsvpCounts: { going: 3, interested: 2, not_going: 1 },
          myRsvp: 'going',
        },
      ],
      meta: { total: 1, limit: 20, offset: 0 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../features/rbac/can', () => ({
  can: () => true,
}));

describe('EventsPage', () => {
  it('renders events overview with upcoming event', () => {
    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Мероприятия')).toBeInTheDocument();
    expect(screen.getByText('Создать мероприятие')).toBeInTheDocument();
    expect(screen.getAllByText('Raid Night').length).toBeGreaterThan(0);
  });
});
