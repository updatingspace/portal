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
  const uid = React.useId();
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [mediaUrl, setMediaUrl] = useState(initialData.media_url || '');
  const [gameId, setGameId] = useState(initialData.game_id || '');
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleChange = React.useCallback(() => {
    const data: OptionCreatePayload = {
      title,
      description: description || undefined,
      media_url: mediaUrl || undefined,
      game_id: gameId || undefined,
    };
    
    if (onChangeRef.current) {
      onChangeRef.current(data);
    }
  }, [description, gameId, mediaUrl, title]);

  // Call onChange when any field changes
  React.useEffect(() => {
    handleChange();
  }, [handleChange]);

  return (
    <div className="voting-form">
      <div>
        <label className="voting-form__label" htmlFor={`${uid}-option-title`}>Название варианта</label>
          <TextInput
            id={`${uid}-option-title`}
            value={title}
            onUpdate={setTitle}
            placeholder="Например: Project Zeta"
          />
      </div>

      <div>
        <label className="voting-form__label" htmlFor={`${uid}-option-description`}>Описание</label>
          <TextArea
            id={`${uid}-option-description`}
            value={description}
            onUpdate={setDescription}
            rows={2}
            placeholder="Короткое пояснение"
          />
      </div>

      <div>
        <label className="voting-form__label" htmlFor={`${uid}-option-media-url`}>Ссылка на медиа</label>
          <TextInput
            id={`${uid}-option-media-url`}
            value={mediaUrl}
            onUpdate={setMediaUrl}
            placeholder="https://..."
          />
      </div>

      <div>
        <label className="voting-form__label" htmlFor={`${uid}-option-game-id`}>Game ID</label>
          <TextInput
            id={`${uid}-option-game-id`}
            value={gameId}
            onUpdate={setGameId}
            placeholder="ID игры или сущности"
          />
      </div>
    </div>
  );
};
