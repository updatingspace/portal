import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../../../app/providers/I18nProvider';
import {EventCard} from './EventCard';
import type {EventWithCounts} from '../types';

const event: EventWithCounts = {id:'e1', tenantId:'t1', scopeType:'TENANT', scopeId:'t1', title:'Ночная встреча', startsAt:'2027-01-01T23:30:00Z', endsAt:'2027-01-02T01:00:00Z', visibility:'public', createdBy:'u1', createdAt:'2026-01-01T00:00:00Z', rsvpCounts:{going:0,interested:0,not_going:0}, myRsvp:null};
it('shows the same local date and timezone in the date badge and event summary', () => {
  localStorage.setItem('portal_locale_v1','ru');
  localStorage.setItem('portal_timezone_v1','Europe/Moscow');
  render(<MemoryRouter><I18nProvider><EventCard event={event}/></I18nProvider></MemoryRouter>);
  expect(screen.getByTestId('event-day')).toHaveTextContent(/^2$/);
  expect(screen.getByText(/Europe\/Moscow/)).toBeVisible();
  expect(screen.getByRole('link', {name:'Ночная встреча'})).toHaveAttribute('href','/app/events/e1');
});
