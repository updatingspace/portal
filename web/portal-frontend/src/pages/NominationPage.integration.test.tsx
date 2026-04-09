import React from 'react';

import { ApiError } from '../api/client';
import { Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');

  const BreadcrumbsStub = ({ children }: { children?: React.ReactNode }) => <nav>{children}</nav>;
  BreadcrumbsStub.Item = ({ children, href }: { children?: React.ReactNode; href?: string }) => <a href={href}>{children}</a>;

  return {
    ...actual,
    Breadcrumbs: BreadcrumbsStub,
    ToasterProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    ToasterComponent: () => null,
  };
});

vi.mock('@/features/voting/components/VotingAlerts', async () => {
  const actual = await vi.importActual<typeof import('@/features/voting/components/VotingAlerts')>(
    '@/features/voting/components/VotingAlerts',
  );

  return {
    ...actual,
    VotingAlerts: ({ alerts }: { alerts: Array<{ id: string; title?: string }> }) => (
      <div>
        {alerts.map((alert) => (
          <div key={alert.id}>{alert.title}</div>
        ))}
      </div>
    ),
  };
});

import { nominationsApiMock } from '../test/mocks/api';
import { createNominationDetail } from '../test/fixtures';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/test-utils';
import { NominationPage } from './NominationPage';
import { withMockedDate } from '../test/time';

const ROUTE_PATH = '/nominations/:id';
const NOMINATION_ID = 'nom-detail';
const NOMINATION_ROUTE = `/nominations/${NOMINATION_ID}`;
const NOMINATION_ROUTE_WITH_LIMIT = `${NOMINATION_ROUTE}?limit=3`;
const MISSING_NOMINATION_ROUTE = '/nominations/missing';

const NOMINATION_TITLE = 'Выбор редакции';
const CLOSED_NOMINATION_TITLE = 'Закрытая номинация';
const RETRY_BUTTON_LABEL = 'Попробовать ещё раз';
const TOGGLE_COUNTERS_LABEL = 'Показать результаты';
const COUNTER_VALUE_PATTERN = /голос(ов|а)?/i;
const UPDATE_VOTE_LABEL = 'Изменить голос';
const SUBMIT_VOTE_LABEL = 'Проголосовать';
const OPTION_1_TITLE = 'Игра 1';
const OPTION_3_TITLE = 'Игра 3';
const OPTION_4_TITLE = 'Игра 4';
const OPTION_CARD_SELECTOR = '.nomination-card-wrapper';
const OPTION_3_ID = 'opt-3';

function renderNominationPage(route: string = NOMINATION_ROUTE) {
  renderWithProviders(
    <Routes>
      <Route path={ROUTE_PATH} element={<NominationPage />} />
    </Routes>,
    { route },
  );
}

function getOptionCard(title: string) {
  const card = screen.getByText(title).closest(OPTION_CARD_SELECTOR);
  expect(card).toBeTruthy();
  return card as HTMLElement;
}

async function clickVoteButtonForOption(title: string) {
  const optionCard = getOptionCard(title);
  await userEvent.click(optionCard);
  const voteButton = screen.getByRole('button', { name: new RegExp(`${SUBMIT_VOTE_LABEL}|${UPDATE_VOTE_LABEL}`) });
  expect(voteButton).toBeEnabled();
  await userEvent.click(voteButton);
}

describe('NominationPage integration', () => {
  test('should load nomination after retry when first request fails', withMockedDate(async () => {
    nominationsApiMock.fetchNomination.mockRejectedValueOnce(
      new ApiError('not_found', { kind: 'not_found', status: 404 }),
    );

    renderNominationPage(MISSING_NOMINATION_ROUTE);

    expect(await screen.findByText('Номинация не найдена')).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: RETRY_BUTTON_LABEL });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);

    expect(nominationsApiMock.fetchNomination).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('heading', { level: 1, name: NOMINATION_TITLE })).toBeInTheDocument();
  }));

  test('should render all options without legacy pagination controls', withMockedDate(async () => {
    renderNominationPage(NOMINATION_ROUTE_WITH_LIMIT);

    expect(await screen.findByRole('heading', { level: 1, name: NOMINATION_TITLE })).toBeInTheDocument();
    expect(screen.getByText(OPTION_1_TITLE)).toBeInTheDocument();
    expect(screen.getByText(OPTION_3_TITLE)).toBeInTheDocument();
    expect(screen.getByText(OPTION_4_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '>' })).not.toBeInTheDocument();
  }));

  test('should show vote counters when user enables counter visibility', withMockedDate(async () => {
    renderNominationPage(NOMINATION_ROUTE_WITH_LIMIT);

    expect(await screen.findByRole('heading', { level: 1, name: NOMINATION_TITLE })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: TOGGLE_COUNTERS_LABEL });
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getAllByText(COUNTER_VALUE_PATTERN).length).toBeGreaterThan(0);
    });
  }));

  test('should submit expected payload when user votes for an option', withMockedDate(async () => {
    renderNominationPage();

    expect(await screen.findByRole('heading', { level: 1, name: NOMINATION_TITLE })).toBeInTheDocument();

    await clickVoteButtonForOption(OPTION_3_TITLE);

    await waitFor(() => {
      expect(nominationsApiMock.voteForOption).toHaveBeenCalledWith({
        nominationId: NOMINATION_ID,
        optionId: OPTION_3_ID,
      });
    });
  }));

  test('should show vote update action after successful vote', withMockedDate(async () => {
    const unvotedNomination = {
      ...createNominationDetail(),
      userVote: null,
    };
    nominationsApiMock.fetchNomination.mockResolvedValueOnce(unvotedNomination);

    renderNominationPage();

    expect(await screen.findByRole('heading', { level: 1, name: NOMINATION_TITLE })).toBeInTheDocument();

    await clickVoteButtonForOption(OPTION_3_TITLE);

    await waitFor(() => {
      expect(nominationsApiMock.voteForOption).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('button', { name: UPDATE_VOTE_LABEL })).toBeInTheDocument();
  }));

  test('should disable voting controls when nomination is closed', withMockedDate(async () => {
    const closedNomination = {
      ...createNominationDetail(),
      title: CLOSED_NOMINATION_TITLE,
      isVotingOpen: false,
      canVote: false,
    };
    nominationsApiMock.fetchNomination.mockResolvedValueOnce(closedNomination);

    renderNominationPage();

    expect(await screen.findByRole('heading', { level: 1, name: CLOSED_NOMINATION_TITLE })).toBeInTheDocument();

    expect(screen.getByText('Завершено')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SUBMIT_VOTE_LABEL })).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-disabled') === 'true')).toBe(true);
  }));
});
