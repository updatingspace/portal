import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MemberAvatar } from './MemberAvatar';

const auth = vi.hoisted(() => ({
  user: { id: 'self', avatarUrl: '/avatar.png' as string | null },
}));

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));

describe('MemberAvatar', () => {
  beforeEach(() => {
    auth.user = { id: 'self', avatarUrl: '/avatar.png' };
  });

  it('uses the available session image for the matching member', () => {
    const { container } = render(<MemberAvatar userId="self" text="MM" size="m" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/avatar.png');
  });

  it('does not show the signed-in user image on another member', () => {
    const { container } = render(<MemberAvatar userId="other" text="AP" size="m" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('AP');
  });

  it('uses initials when no photo is available', () => {
    auth.user.avatarUrl = null;
    const { container } = render(<MemberAvatar userId="self" text="MM" size="m" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('MM');
  });

  it('returns to initials after an image error and tries a refreshed URL', () => {
    const { container, rerender } = render(<MemberAvatar userId="self" text="MM" size="m" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('MM');
    auth.user.avatarUrl = '/refreshed-avatar.png';
    rerender(<MemberAvatar userId="self" text="MM" size="m" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/refreshed-avatar.png');
  });

  it('removes the old photo when the account changes', () => {
    const { container, rerender } = render(<MemberAvatar userId="self" text="MM" size="m" />);
    auth.user = { id: 'another-account', avatarUrl: '/another-avatar.png' };
    rerender(<MemberAvatar userId="self" text="MM" size="m" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('MM');
  });
});
