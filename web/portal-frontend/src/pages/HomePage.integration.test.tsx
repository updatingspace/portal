import React from 'react';

import { ApiError } from '../api/client';
import { HomePage } from './HomePage';
import { votingsApiMock } from '../test/mocks/api';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { withMockedDate } from '../test/time';

const LOADER_TEXT = 'Подтягиваем голосования...';
const ACTIVE_SECTION_TEXT = 'Актуальные голосования';
const MAIN_VOTING_TITLE = 'AEF Game Jam · основной поток';
const EXPRESS_VOTING_TITLE = 'Экспресс-опрос';
const ARCHIVED_VOTING_TITLE = 'Архив 2024';
const RETRY_BUTTON_LABEL = 'Попробовать еще раз';
const REFRESH_BUTTON_LABEL = 'Обновить список';

function renderHomePage() {
  renderWithProviders(<HomePage />);
}

describe('HomePage integration', () => {
  test('shows loading text before catalog data is rendered', withMockedDate(async () => {
    renderHomePage();

    expect(screen.getByText(LOADER_TEXT)).toBeInTheDocument();
    expect(await screen.findByText(ACTIVE_SECTION_TEXT)).toBeInTheDocument();
  }));

  test('renders catalog sections after loading', withMockedDate(async () => {
    renderHomePage();

    expect(await screen.findByText(ACTIVE_SECTION_TEXT)).toBeInTheDocument();
    expect(screen.getByText(MAIN_VOTING_TITLE)).toBeInTheDocument();
    expect(screen.getByText(EXPRESS_VOTING_TITLE)).toBeInTheDocument();
    expect(screen.getByText(ARCHIVED_VOTING_TITLE)).toBeInTheDocument();
  }));

  test('retries catalog load when user clicks retry after server error', withMockedDate(async () => {
    votingsApiMock.fetchVotingCatalog.mockRejectedValueOnce(
      new ApiError('fail', { kind: 'server', status: 500 }),
    );

    renderHomePage();

    expect(await screen.findByText(/Сервис недоступен|Не удалось загрузить голосования/)).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: RETRY_BUTTON_LABEL });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);

    expect(await screen.findByText(MAIN_VOTING_TITLE)).toBeInTheDocument();
    expect(votingsApiMock.fetchVotingCatalog).toHaveBeenCalledTimes(2);
  }));

  test('re-requests catalog when user clicks manual refresh', withMockedDate(async () => {
    renderHomePage();

    expect(await screen.findByText(MAIN_VOTING_TITLE)).toBeInTheDocument();

    const refreshBtn = screen.getByRole('button', { name: REFRESH_BUTTON_LABEL });
    expect(refreshBtn).toBeEnabled();
    await userEvent.click(refreshBtn);

    expect(votingsApiMock.fetchVotingCatalog).toHaveBeenCalledTimes(2);
  }));
});
