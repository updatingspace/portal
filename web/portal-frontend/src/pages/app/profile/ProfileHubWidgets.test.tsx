import React from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { render, screen, userEvent } from '../../../test/test-utils';
import { AchievementsWidget } from './components/widgets/AchievementsWidget';
import { CommunitiesWidget } from './components/widgets/CommunitiesWidget';
import { FollowersWidget } from './components/widgets/FollowersWidget';
import { FollowingWidget } from './components/widgets/FollowingWidget';
import { FriendsWidget } from './components/widgets/FriendsWidget';

describe('Profile hub widgets', () => {
  it('renders empty texts for all list widgets', () => {
    render(
      <MemoryRouter>
        <div>
          <AchievementsWidget items={[]} />
          <FollowingWidget items={[]} />
          <FollowersWidget items={[]} />
          <CommunitiesWidget items={[]} />
          <FriendsWidget items={[]} />
        </div>
      </MemoryRouter>,
    );

    expect(screen.getByText('Пока нет достижений')).toBeInTheDocument();
    expect(screen.getByText('Пока нет подписок')).toBeInTheDocument();
    expect(screen.getByText('Пока нет подписчиков')).toBeInTheDocument();
    expect(screen.getByText('Пока нет сообществ')).toBeInTheDocument();
    expect(screen.getByText('Пока нет друзей')).toBeInTheDocument();
  });

  it('navigates to expected route from CTA', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/app/profile']}>
        <Routes>
          <Route path="/app/profile" element={<FollowingWidget items={[]} />} />
          <Route path="/app/profile/following" element={<div>Following route reached</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Показать все' }));
    expect(screen.getByText('Following route reached')).toBeInTheDocument();
  });
});
