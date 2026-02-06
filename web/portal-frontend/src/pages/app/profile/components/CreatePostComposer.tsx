import React, { useState } from 'react';
import { Button, Card, Text, TextArea } from '@gravity-ui/uikit';

import { profileHubStrings } from '../strings/ru';

type CreatePostComposerProps = {
  canCreatePost: boolean;
  onPublish: (body: string) => Promise<void>;
};

export const CreatePostComposer: React.FC<CreatePostComposerProps> = ({
  canCreatePost,
  onPublish,
}) => {
  const [value, setValue] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    const trimmed = value.trim();
    if (!trimmed || !canCreatePost || isPublishing) return;
    setIsPublishing(true);
    try {
      await onPublish(trimmed);
      setValue('');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card view="filled" className="profile-hub__composer">
      <TextArea
        value={value}
        onUpdate={setValue}
        minRows={3}
        maxRows={8}
        disabled={!canCreatePost}
        placeholder={profileHubStrings.composerPlaceholder}
      />
      <div className="profile-hub__composer-footer">
        {!canCreatePost && (
          <Text variant="caption-2" color="secondary">
            {profileHubStrings.composerNoPermission}
          </Text>
        )}
        <Button
          view="action"
          size="m"
          loading={isPublishing}
          disabled={!canCreatePost || !value.trim()}
          onClick={handlePublish}
        >
          {profileHubStrings.composerPublish}
        </Button>
      </div>
    </Card>
  );
};
