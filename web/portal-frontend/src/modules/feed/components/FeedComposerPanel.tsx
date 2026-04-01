import React from 'react';
import { Button, Card, Icon, Select, Text } from '@gravity-ui/uikit';
import { MarkdownEditorView } from '@gravity-ui/markdown-editor';
import { Plus } from '@gravity-ui/icons';

import type { NewsMediaItem } from '../../../types/activity';

type FeedComposerPanelProps = {
  canCreateNews: boolean;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  emptyToolbarsPreset: { items: Record<string, unknown>; orders: Record<string, unknown> };
  editor: unknown;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (files: FileList | null) => void;
  detectedTags: string[];
  composerError: string | null;
  newsVisibility: 'public' | 'private';
  setNewsVisibility: (value: 'public' | 'private') => void;
  isCreatingNews: boolean;
  uploading: boolean;
  composerHasText: boolean;
  composerHasMedia: boolean;
  handlePublishNews: () => void;
  handleComposerKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  newsMedia: NewsMediaItem[];
  handleRemoveMedia: (index: number) => void;
};

export const FeedComposerPanel: React.FC<FeedComposerPanelProps> = ({
  canCreateNews,
  composerOpen,
  setComposerOpen,
  emptyToolbarsPreset,
  editor,
  fileInputRef,
  handleImageUpload,
  detectedTags,
  composerError,
  newsVisibility,
  setNewsVisibility,
  isCreatingNews,
  uploading,
  composerHasText,
  composerHasMedia,
  handlePublishNews,
  handleComposerKeyDown,
  newsMedia,
  handleRemoveMedia,
}) => {
  if (!canCreateNews) {
    return (
      <Card view="filled" className="feed-empty" data-qa="feed-composer-locked">
        <Text variant="subheader-2">Публикация новостей недоступна.</Text>
        <Text variant="body-2" color="secondary">
          Для создания новостей требуется дополнительный доступ.
        </Text>
      </Card>
    );
  }

  return (
    <Card
      view="filled"
      className={['feed-composer', composerOpen ? 'feed-composer--expanded' : ''].filter(Boolean).join(' ')}
      data-qa="feed-composer"
      aria-label="Композер новостей"
      onKeyDown={handleComposerKeyDown}
    >
      <div className="feed-composer__header">
        <Text variant="subheader-2">Что происходит?</Text>
        <Text variant="caption-2" color="secondary">
          Быстрая отправка: Ctrl/Cmd + Enter
        </Text>
      </div>

      <div className="feed-composer__editor" onClick={() => setComposerOpen(true)}>
        <MarkdownEditorView
          editor={editor as never}
          stickyToolbar={false}
          settingsVisible={false}
          toolbarsPreset={emptyToolbarsPreset}
        />
      </div>

      <div className="feed-composer__footer">
        <div className="feed-composer__media-bar">
          <button
            type="button"
            className="feed-composer__media-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Добавить изображения"
          >
            <Icon data={Plus} />
          </button>
          <Text variant="caption-2" color="secondary">
            Добавьте изображения (только картинки)
          </Text>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleImageUpload(event.target.files)}
            aria-label="Загрузка изображений"
          />
        </div>
        {detectedTags.length > 0 && (
          <div className="feed-composer__tags">
            {detectedTags.map((tag) => (
              <span key={tag} className="feed-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {composerError && (
          <Text variant="caption-2" color="danger">
            {composerError}
          </Text>
        )}
        <div className="feed-composer__actions">
          <Select
            value={[newsVisibility]}
            onUpdate={(values) => {
              const next = values[0] as 'public' | 'private' | undefined;
              if (next) setNewsVisibility(next);
            }}
            options={[
              { value: 'public', content: 'Публично' },
              { value: 'private', content: 'Только мне' },
            ]}
          />
          <Button
            view="action"
            size="m"
            loading={isCreatingNews || uploading}
            disabled={!composerHasText || !composerHasMedia}
            onClick={handlePublishNews}
            aria-label="Опубликовать новость"
          >
            Опубликовать
          </Button>
        </div>
      </div>

      {newsMedia.length > 0 && (
        <div className="feed-composer__media">
          {newsMedia.map((media, index) => (
            <div key={`${media.type}-${index}`} className="feed-composer__media-item">
              {media.type === 'image' && media.url ? <img src={media.url} alt="preview" /> : null}
              <Button view="flat" size="xs" onClick={() => handleRemoveMedia(index)}>
                Удалить
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
