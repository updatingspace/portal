import React from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { render, screen, userEvent } from '../../../test/test-utils';
import { AchievementsWidget } from './components/widgets/AchievementsWidget';
import { CommunitiesWidget } from './components/widgets/CommunitiesWidget';
import { FollowersWidget } from './components/widgets/FollowersWidget';
import { FollowingWidget } from './components/widgets/FollowingWidget';
import { FriendsWidget } from './components/widgets/FriendsWidget';

const EMPTY_WIDGET_CASES = [
  { title: 'achievements', component: AchievementsWidget, emptyText: 'Пока нет достижений' },
  { title: 'following', component: FollowingWidget, emptyText: 'Пока нет подписок' },
  { title: 'followers', component: FollowersWidget, emptyText: 'Пока нет подписчиков' },
  { title: 'communities', component: CommunitiesWidget, emptyText: 'Пока нет сообществ' },
  { title: 'friends', component: FriendsWidget, emptyText: 'Пока нет друзей' },
] as const;

describe('Profile hub widgets', () => {
  it.each(EMPTY_WIDGET_CASES)('renders empty text for $title widget', ({ component: Widget, emptyText }) => {
    render(
      <MemoryRouter>
        <Widget items={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText(emptyText)).toBeInTheDocument();
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
