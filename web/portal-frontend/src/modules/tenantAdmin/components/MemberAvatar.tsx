import { useState } from 'react';
import { Avatar, type AvatarProps } from '@gravity-ui/uikit';
import { useAuth } from '../../../contexts/AuthContext';

export function MemberAvatar({
  userId,
  text,
  size,
}: {
  userId?: string;
  text: string;
  size: AvatarProps['size'];
}) {
  const { user } = useAuth();
  // The member directory has no avatar field. Reuse the session photo only
  // for its owner, just as the account menu does; never persist signed URLs.
  const avatarUrl = userId === user?.id ? user?.avatarUrl : undefined;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span
      className="tenant-member-avatar"
      aria-hidden="true"
      onErrorCapture={() => setFailedUrl(avatarUrl ?? null)}
    >
      {avatarUrl && avatarUrl !== failedUrl ? (
        <Avatar size={size} imgUrl={avatarUrl} alt="" />
      ) : (
        <Avatar size={size} text={text} />
      )}
    </span>
  );
}
