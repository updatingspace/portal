import React from 'react';
import { Card, Icon, Loader, Select, Text } from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare, Plus } from '@gravity-ui/icons';

import type { NewsMediaItem } from '../../../types/activity';

type FeedComposerPanelProps = {
  canCreateNews: boolean;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  composerValue: string;
  setComposerValue: (value: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (files: FileList | null) => void;
  detectedTags: string[];
  publishMode: 'public' | 'private' | 'draft';
  setPublishMode: (value: 'public' | 'private' | 'draft') => void;
  isCreatingNews: boolean;
  uploading: boolean;
  canPublishNews: boolean;
  handlePublishNews: () => void;
  handleComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  newsMedia: NewsMediaItem[];
  handleRemoveMedia: (index: number) => void;
};

const MIN_COMPACT_HEIGHT = 72;
const MIN_EXPANDED_HEIGHT = 120;
const MAX_COMPOSER_HEIGHT = 260;

export const FeedComposerPanel: React.FC<FeedComposerPanelProps> = ({
  canCreateNews,
  composerOpen,
  setComposerOpen,
  composerValue,
  setComposerValue,
  fileInputRef,
  handleImageUpload,
  detectedTags,
  publishMode,
  setPublishMode,
  isCreatingNews,
  uploading,
  canPublishNews,
  handlePublishNews,
  handleComposerKeyDown,
  newsMedia,
  handleRemoveMedia,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const minHeight = composerOpen ? MIN_EXPANDED_HEIGHT : MIN_COMPACT_HEIGHT;
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      MAX_COMPOSER_HEIGHT,
    );
    textarea.style.height = `${nextHeight}px`;
  }, [composerOpen, composerValue]);

  const submitLabel =
    publishMode === 'draft'
      ? 'Сохранить черновик'
      : publishMode === 'private'
        ? 'Опубликовать приватно'
        : 'Опубликовать публично';

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
      className={['feed-composer', composerOpen ? 'feed-composer--expanded' : '']
        .filter(Boolean)
        .join(' ')}
      data-qa="feed-composer"
      aria-label="Композер новостей"
    >
      <div className="feed-composer__header">
        <Text variant="subheader-2">Что происходит?</Text>
        <Text variant="caption-2" color="secondary">
          Быстрая отправка: Ctrl/Cmd + Enter
        </Text>
      </div>

      <div
        className="feed-composer__shell"
        onClick={() => {
          setComposerOpen(true);
          textareaRef.current?.focus();
        }}
      >
        <textarea
          ref={textareaRef}
          className="feed-composer__textarea"
          value={composerValue}
          onChange={(event) => setComposerValue(event.target.value)}
          onFocus={() => setComposerOpen(true)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Поделитесь новостью, коротким обновлением или ссылкой на YouTube"
          aria-label="Текст новости"
          rows={1}
        />

        {detectedTags.length > 0 && (
          <div className="feed-composer__tags">
            {detectedTags.map((tag) => (
              <span key={tag} className="feed-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="feed-composer__controls">
          <div className="feed-composer__controls-left">
            <button
              type="button"
              className="feed-composer__media-button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              aria-label="Добавить изображения"
            >
              <Icon data={Plus} />
            </button>
            <Text variant="caption-2" color="secondary" className="feed-composer__hint">
              Добавьте изображения при необходимости
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

          <div className="feed-composer__controls-right">
            <div className="feed-composer__visibility">
              <Select
                value={[publishMode]}
                onUpdate={(values) => {
                  const next = values[0] as 'public' | 'private' | 'draft' | undefined;
                  if (next) setPublishMode(next);
                }}
                options={[
                  { value: 'public', content: 'Опубликовать публично' },
                  { value: 'private', content: 'Опубликовать приватно' },
                  { value: 'draft', content: 'Сохранить черновик' },
                ]}
              />
            </div>

            <button
              type="button"
              className={[
                'feed-composer__submit',
                canPublishNews ? 'feed-composer__submit--ready' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!canPublishNews}
              onClick={(event) => {
                event.stopPropagation();
                handlePublishNews();
              }}
              aria-label={submitLabel}
              title={submitLabel}
              data-qa="composer-submit"
            >
              {isCreatingNews || uploading ? (
                <Loader size="s" />
              ) : (
                <Icon data={ArrowUpRightFromSquare} />
              )}
            </button>
          </div>
        </div>
      </div>

      {newsMedia.length > 0 && (
        <div className="feed-composer__media">
          {newsMedia.map((media, index) => (
            <div key={`${media.type}-${index}`} className="feed-composer__media-item">
              {media.type === 'image' && media.url ? <img src={media.url} alt="preview" /> : null}
              <button
                type="button"
                className="feed-composer__media-remove"
                onClick={() => handleRemoveMedia(index)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
