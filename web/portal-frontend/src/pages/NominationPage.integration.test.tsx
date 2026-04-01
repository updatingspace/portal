import React from 'react';

import { ApiError } from '../api/client';
import { Routes, Route } from 'react-router-dom';

import { nominationsApiMock } from '../test/mocks/api';
import { createNominationDetail } from '../test/fixtures';
import { renderWithProviders, screen, userEvent, within, waitFor } from '../test/test-utils';
import { NominationPage } from './NominationPage';
import { withMockedDate } from '../test/time';

const ROUTE_PATH = '/nominations/:id';
const NOMINATION_ID = 'nom-detail';
const NOMINATION_ROUTE = `/nominations/${NOMINATION_ID}`;
const NOMINATION_ROUTE_WITH_LIMIT = `${NOMINATION_ROUTE}?limit=3`;
const MISSING_NOMINATION_ROUTE = '/nominations/missing';

const NOMINATION_TITLE = 'Выбор редакции';
const CLOSED_NOMINATION_TITLE = 'Закрытая номинация';
const RETRY_BUTTON_LABEL = 'Попробовать еще раз';
const NEXT_PAGE_BUTTON_LABEL = '>';
const TOGGLE_COUNTERS_LABEL = 'Посмотреть количество голосов';
const COUNTER_VALUE_PATTERN = /Голосов:/;
const CLOSED_VOTING_LABEL = 'Голосование завершено';
const UPDATE_VOTE_LABEL = 'Обновить голос';

const FIRST_PAGE_LABEL = 'Страница 1 из 3';
const SECOND_PAGE_LABEL = 'Страница 2 из 3';
const OPTION_1_TITLE = 'Игра 1';
const OPTION_3_TITLE = 'Игра 3';
const OPTION_4_TITLE = 'Игра 4';
const OPTION_CARD_SELECTOR = '.option-card';
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
  const voteButton = within(optionCard).getByRole('button');
  expect(voteButton).toBeEnabled();
  await userEvent.click(voteButton);
}

describe('NominationPage integration', () => {
  test('should load nomination after retry when first request fails', withMockedDate(async () => {
    nominationsApiMock.fetchNomination.mockRejectedValueOnce(
      new ApiError('not_found', { kind: 'not_found', status: 404 }),
    );

    renderNominationPage(MISSING_NOMINATION_ROUTE);

    const notFoundMessages = await screen.findAllByText('Не найдено');
    expect(notFoundMessages.length).toBeGreaterThan(0);

    const retry = screen.getByRole('button', { name: RETRY_BUTTON_LABEL });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);

    expect(nominationsApiMock.fetchNomination).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();
  }));

  test('should show next page options when user clicks next page', withMockedDate(async () => {
    renderNominationPage(NOMINATION_ROUTE_WITH_LIMIT);

    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();
    expect(screen.getByText(FIRST_PAGE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(OPTION_1_TITLE)).toBeInTheDocument();
    expect(screen.getByText(OPTION_3_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(OPTION_4_TITLE)).not.toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: NEXT_PAGE_BUTTON_LABEL });
    expect(nextBtn).toBeEnabled();
    await userEvent.click(nextBtn);

    expect(screen.getByText(SECOND_PAGE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(OPTION_4_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(OPTION_1_TITLE)).not.toBeInTheDocument();
  }));

  test('should show vote counters when user enables counter visibility', withMockedDate(async () => {
    renderNominationPage(NOMINATION_ROUTE_WITH_LIMIT);

    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();

    const toggle = screen.getByLabelText(TOGGLE_COUNTERS_LABEL);
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getAllByText(COUNTER_VALUE_PATTERN).length).toBeGreaterThan(0);
    });
  }));

  test('should submit expected payload when user votes for an option', withMockedDate(async () => {
    renderNominationPage();

    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();

    await clickVoteButtonForOption(OPTION_3_TITLE);

    await waitFor(() => {
      expect(nominationsApiMock.voteForOption).toHaveBeenCalledWith({
        nominationId: NOMINATION_ID,
        optionId: OPTION_3_ID,
      });
    });
  }));

  test('should show vote update action after successful vote', withMockedDate(async () => {
    renderNominationPage();

    expect(await screen.findByText(NOMINATION_TITLE)).toBeInTheDocument();

    await clickVoteButtonForOption(OPTION_3_TITLE);

    await waitFor(() => {
      expect(nominationsApiMock.voteForOption).toHaveBeenCalledTimes(1);
    });

    const updatedCard = getOptionCard(OPTION_3_TITLE);
    expect(within(updatedCard).getByRole('button', { name: UPDATE_VOTE_LABEL })).toBeInTheDocument();
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

    expect(await screen.findByText(CLOSED_NOMINATION_TITLE)).toBeInTheDocument();

    const closedNotices = screen.getAllByText(CLOSED_VOTING_LABEL);
    expect(closedNotices.length).toBeGreaterThan(0);

    const lockedBtns = screen.getAllByRole('button', { name: CLOSED_VOTING_LABEL });
    expect(lockedBtns.length).toBeGreaterThan(0);
    expect(lockedBtns[0]).toBeDisabled();
  }));
});
