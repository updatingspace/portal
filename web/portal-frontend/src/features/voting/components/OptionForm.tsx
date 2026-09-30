import { useState } from 'react';
import { TextArea, TextInput } from '@gravity-ui/uikit';
import { FormField } from '../../../shared/ui/portal/PortalUI';
import type { OptionCreatePayload } from '../types';
interface OptionFormProps {
  initialData?: Partial<OptionCreatePayload>;
  value?: OptionCreatePayload;
  onChange?: (data: OptionCreatePayload) => void;
}
export function OptionForm({
  initialData = {},
  value,
  onChange,
}: OptionFormProps) {
  const [local, setLocal] = useState<OptionCreatePayload>({
    title: initialData.title || '',
    description: initialData.description,
    media_url: initialData.media_url,
    game_id: initialData.game_id,
  });
  const current = value ?? local;
  const update = (patch: Partial<OptionCreatePayload>) => {
    const next = { ...current, ...patch };
    if (!value) setLocal(next);
    onChange?.(next);
  };
  return (
    <div className="portal-stack">
      <FormField label="Название варианта">
        {(props) => (
          <TextInput
            {...props}
            size="xl"
            value={current.title}
            onUpdate={(title) => update({ title })}
            placeholder="Например: Project Zeta"
          />
        )}
      </FormField>
      <details className="portal-disclosure">
        <summary>Описание и медиа варианта</summary>
        <div className="portal-stack">
          <FormField label="Описание варианта">
            {(props) => (
              <TextArea
                {...props}
                size="xl"
                rows={2}
                value={current.description || ''}
                onUpdate={(description) =>
                  update({ description: description || undefined })
                }
              />
            )}
          </FormField>
          <FormField label="Ссылка на медиа">
            {(props) => (
              <TextInput
                {...props}
                size="xl"
                value={current.media_url || ''}
                onUpdate={(media_url) =>
                  update({ media_url: media_url || undefined })
                }
                placeholder="https://…"
              />
            )}
          </FormField>
          <FormField
            label="Идентификатор игры"
            hint="Необязательно. Заполняется для варианта, связанного с каталогом игр."
          >
            {(props) => (
              <TextInput
                {...props}
                size="xl"
                value={current.game_id || ''}
                onUpdate={(game_id) =>
                  update({ game_id: game_id || undefined })
                }
              />
            )}
          </FormField>
        </div>
      </details>
    </div>
  );
}
