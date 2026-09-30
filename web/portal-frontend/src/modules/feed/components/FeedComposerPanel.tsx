import React from 'react';
import { Button, Card, Icon, Select, Text } from '@gravity-ui/uikit';
import { Plus } from '@gravity-ui/icons';

import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { InlineError } from '../../../shared/ui/portal/PortalUI';
import type { NewsMediaItem } from '../../../types/activity';

type FeedComposerPanelProps = {
  publishError?: string | null;
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
  publishError,
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
  const mobile = useMediaQuery('(max-width: 719px)');
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

  React.useEffect(() => {
    if (mobile && composerOpen) textareaRef.current?.focus();
  }, [mobile, composerOpen]);

  const submitLabel =
    publishMode === 'draft'
      ? 'Сохранить черновик'
      : publishMode === 'private'
        ? 'Опубликовать приватно'
        : 'Опубликовать в сообществе';

  if (!canCreateNews) {
    return null;
  }

  const editor = (
    <Card
      view="filled"
      className={[
        'feed-composer',
        composerOpen ? 'feed-composer--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-qa="feed-composer"
      aria-label="Композер новостей"
    >
      {!mobile && (
        <div className="feed-composer__header">
          <Text variant="subheader-2">Новая публикация</Text>
          <Text
            variant="caption-2"
            color="secondary"
            className="feed-composer__shortcut"
          >
            Быстрая отправка: Ctrl/Cmd + Enter
          </Text>
        </div>
      )}

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
          placeholder="Поделитесь новостью или планами"
          aria-label="Текст новости"
          rows={mobile ? 7 : 1}
          autoFocus={mobile}
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

        {publishError && <InlineError>{publishError}</InlineError>}
        <div className="feed-composer__controls">
          <div className="feed-composer__controls-left">
            <Button
              view="flat"
              size="xl"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              aria-label="Добавить изображения"
              disabled={uploading || isCreatingNews}
            >
              <Icon data={Plus} />
              Фото
            </Button>
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
                size="xl"
                aria-label="Аудитория публикации"
                onUpdate={(values) => {
                  const next = values[0] as
                    | 'public'
                    | 'private'
                    | 'draft'
                    | undefined;
                  if (next) setPublishMode(next);
                }}
                options={[
                  { value: 'public', content: 'Сообществу' },
                  { value: 'private', content: 'Только мне' },
                  { value: 'draft', content: 'Черновик' },
                ]}
              />
            </div>

            <Button
              size="xl"
              view="action"
              disabled={!canPublishNews || isCreatingNews || uploading}
              loading={isCreatingNews || uploading}
              onClick={handlePublishNews}
              aria-label={submitLabel}
              qa="composer-submit"
            >
              {publishMode === 'draft' ? 'Сохранить черновик' : 'Опубликовать'}
            </Button>
          </div>
        </div>
      </div>

      {newsMedia.length > 0 && (
        <div className="feed-composer__media">
          {newsMedia.map((media, index) => (
            <div
              key={`${media.type}-${index}`}
              className="feed-composer__media-item"
            >
              {media.type === 'image' && media.url ? (
                <img src={media.url} alt="Изображение для публикации" />
              ) : null}
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
  if (!mobile) return editor;
  return (
    <>
      <Button
        className="feed-composer-launch"
        view="action"
        size="xl"
        aria-label="Написать публикацию"
        onClick={() => setComposerOpen(true)}
      >
        <Icon data={Plus} size={20} />
      </Button>
      {composerOpen && (
        <ContentDialog
          title="Новая публикация"
          busy={isCreatingNews || uploading}
          onClose={() => setComposerOpen(false)}
        >
          {editor}
        </ContentDialog>
      )}
    </>
  );
};
