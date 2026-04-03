import React from 'react';

import { ApiError } from '../api/client';
import { nominationsApiMock } from '../test/mocks/api';
import { Routes, Route } from 'react-router-dom';

import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { VotingPage } from './VotingPage';
import { withMockedDate } from '../test/time';

const LOADER_TEXT = 'Загружаем номинации...';
const NOMINATION_TITLE = 'Лучшая графика';
const SECOND_NOMINATION_TITLE = 'Лучший геймплей';
const ACTIVE_STATUS_LABEL = 'Активно';
const RETRY_BUTTON_LABEL = 'Попробовать еще раз';
const VOTING_ROUTE = '/votings/vote-active';
const VOTING_ROUTE_PATH = '/votings/:votingId';
const FIRST_NOMINATION_LINK = '/nominations/nom-1';

function renderVotingPage() {
  renderWithProviders(
    <Routes>
      <Route path={VOTING_ROUTE_PATH} element={<VotingPage />} />
    </Routes>,
    { route: VOTING_ROUTE },
  );
}

describe('VotingPage integration', () => {
  test('shows loading indicator before nominations are rendered', withMockedDate(async () => {
    renderVotingPage();

    expect(screen.getByText(LOADER_TEXT)).toBeInTheDocument();
    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();
  }));

  test('renders nominations and first nomination link after loading', withMockedDate(async () => {
    renderVotingPage();

    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();
    expect(screen.getByText(SECOND_NOMINATION_TITLE)).toBeInTheDocument();
    expect(screen.getByText(ACTIVE_STATUS_LABEL)).toBeInTheDocument();

    const firstLink = screen.getByRole('link', { name: NOMINATION_TITLE });
    expect(firstLink).toHaveAttribute('href', FIRST_NOMINATION_LINK);
  }));

  test('retries nominations fetch when user clicks retry', withMockedDate(async () => {
    nominationsApiMock.fetchNominations.mockRejectedValueOnce(
      new ApiError('fail', { kind: 'server', status: 500 }),
    );

    renderVotingPage();

    const retryButton = await screen.findByRole('button', { name: RETRY_BUTTON_LABEL });
    expect(retryButton).toBeEnabled();
    await userEvent.click(retryButton);

    expect(nominationsApiMock.fetchNominations).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();
  }));
});
