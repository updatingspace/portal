import { useAuth } from '../../../../contexts/AuthContext';
import { useSessionDraft } from '../../../../shared/hooks/useSessionDraft';
import React, { useRef, useState } from 'react';
import { Button, Text, TextArea } from '@gravity-ui/uikit';

import { useUITranslation } from '../../../../shared/ui/portal/PortalUI';
import { profileHubStrings } from '../strings/ru';

type CreatePostComposerProps = {
  canCreatePost: boolean;
  onPublish: (body: string) => Promise<void>;
  onPublished?: () => void;
};

export const CreatePostComposer: React.FC<CreatePostComposerProps> = ({
  canCreatePost,
  onPublish,
  onPublished,
}) => {
  const t = useUITranslation();
  const { user } = useAuth();
  const { value, setValue, clear, guard } = useSessionDraft(
    `${user?.id}:${user?.tenant?.id}:profile-post`,
    '',
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  const handlePublish = async () => {
    const trimmed = value.trim();
    if (!trimmed || !canCreatePost || pending.current) return;
    const submitted = value;
    pending.current = true;
    setFailed(false);
    setIsPublishing(true);
    try {
      await onPublish(trimmed);
      if (latest.current === submitted) {
        clear('');
        onPublished?.();
      }
      setValue((current) => (current === submitted ? '' : current));
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setIsPublishing(false);
    }
  };

  return (
    <form
      className="profile-hub__composer"
      onSubmit={(event) => {
        event.preventDefault();
        void handlePublish();
      }}
    >
      <p className="profile-hub__audience">
        {t('В сообществе', 'In this community')}
      </p>
      {guard}
      <TextArea
        id="profile-post-draft"
        aria-label={profileHubStrings.composerPlaceholder}
        value={value}
        onUpdate={setValue}
        autoFocus
        minRows={7}
        maxRows={15}
        disabled={!canCreatePost}
        placeholder={profileHubStrings.composerPlaceholder}
      />
      <p className="profile-hub__draft-note">
        {t(
          'Можно закрыть — текст останется в этой вкладке.',
          'You can close this window. Your text stays in this tab.',
        )}
      </p>
      <div className="profile-hub__composer-footer">
        {failed && (
          <Text as="p" role="alert" color="danger">
            {profileHubStrings.publishError}
          </Text>
        )}
        {!canCreatePost && (
          <Text variant="caption-2" color="secondary">
            {profileHubStrings.composerNoPermission}
          </Text>
        )}
        <Button
          view="action"
          size="xl"
          loading={isPublishing}
          disabled={!canCreatePost || !value.trim()}
          type="submit"
        >
          {profileHubStrings.composerPublish}
        </Button>
      </div>
    </form>
  );
};
