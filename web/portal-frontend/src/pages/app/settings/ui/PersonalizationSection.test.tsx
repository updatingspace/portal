import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PersonalizationSection } from './PersonalizationSection';

vi.mock('../../../../features/personalization', () => ({
  UserSettingsPanel: () => <div>User Settings Panel</div>,
}));

describe('Settings PersonalizationSection', () => {
  it('renders only the user settings panel', () => {
    render(<PersonalizationSection />);

    expect(screen.getByText('User Settings Panel')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard layout')).not.toBeInTheDocument();
  });
});
