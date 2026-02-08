import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { EventPage } from './EventPage';

vi.mock('@gravity-ui/uikit', () => ({
  Button: (props: React.ComponentProps<'button'> & { loading?: boolean }) => <button {...props} />,
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
    render(
      <MemoryRouter initialEntries={['/app/events/event-1']}>
        <Routes>
          <Route path="/app/events/:id" element={<EventPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Community Meetup')).toBeInTheDocument();
    expect(screen.getByText('RSVP')).toBeInTheDocument();
    expect(screen.getByText('Иду')).toBeInTheDocument();
    expect(screen.getByText('Интересно')).toBeInTheDocument();
    expect(screen.getByText('Не пойду')).toBeInTheDocument();
  });
});
