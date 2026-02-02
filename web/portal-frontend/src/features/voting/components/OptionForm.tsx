import React, { useState } from 'react';
import { TextArea, TextInput } from '@gravity-ui/uikit';
import type { OptionCreatePayload } from '../types';

interface OptionFormProps {
  initialData?: Partial<OptionCreatePayload>;
  onChange?: (data: OptionCreatePayload) => void;
}

export const OptionForm: React.FC<OptionFormProps> = ({
  initialData = {},
  onChange,
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [mediaUrl, setMediaUrl] = useState(initialData.media_url || '');
  const [gameId, setGameId] = useState(initialData.game_id || '');

  const handleChange = () => {
    const data: OptionCreatePayload = {
      title,
      description: description || undefined,
      media_url: mediaUrl || undefined,
      game_id: gameId || undefined,
    };
    
    if (onChange) {
      onChange(data);
    }
  };

  // Call onChange when any field changes
  React.useEffect(() => {
    handleChange();
  }, [title, description, mediaUrl, gameId, onChange]);

  return (
    <div className="space-y-4">
      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Название варианта</div>
          <TextInput
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Project Zeta"
          />
        </div>
      </div>

      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Описание</div>
          <TextArea
            value={description}
            onUpdate={setDescription}
            rows={2}
            placeholder="Короткое пояснение"
          />
        </div>
      </div>

      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Ссылка на медиа</div>
          <TextInput
            value={mediaUrl}
            onUpdate={setMediaUrl}
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700">Game ID</div>
          <TextInput
            value={gameId}
            onUpdate={setGameId}
            placeholder="ID игры или сущности"
          />
        </div>
      </div>
    </div>
  );
};
