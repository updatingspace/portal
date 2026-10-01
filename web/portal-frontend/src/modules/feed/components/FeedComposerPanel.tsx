import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
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
  const t = useUITranslation();
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
      ? t('Сохранить черновик', 'Save draft')
      : publishMode === 'private'
        ? t('Опубликовать приватно', 'Publish privately')
        : t('Опубликовать в сообществе', 'Publish to community');

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
      aria-label={t('Композер новостей', 'New post')}
    >
      {!mobile && (
        <div className="feed-composer__header">
          <Text variant="subheader-2">{t('Новая публикация', 'New post')}</Text>
          <Text
            variant="caption-2"
            color="secondary"
            className="feed-composer__shortcut"
          >
            {typeof navigator !== 'undefined' &&
            /Mac|iPhone|iPad/.test(navigator.platform)
              ? '⌘'
              : 'Ctrl'}{' '}
            + Enter
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
          placeholder={t(
            'Поделитесь новостью или планами',
            'Share news or plans',
          )}
          aria-label={t('Текст новости', 'Post text')}
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
              aria-label={t('Добавить изображения', 'Add images')}
              disabled={uploading || isCreatingNews}
            >
              <Icon data={Plus} />
              {t('Фото', 'Photo')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => handleImageUpload(event.target.files)}
              aria-label={t('Загрузка изображений', 'Upload images')}
            />
          </div>

          <div className="feed-composer__controls-right">
            <div className="feed-composer__visibility">
              <Select
                value={[publishMode]}
                size="xl"
                aria-label={t('Аудитория публикации', 'Audience')}
                onUpdate={(values) => {
                  const next = values[0] as
                    | 'public'
                    | 'private'
                    | 'draft'
                    | undefined;
                  if (next) setPublishMode(next);
                }}
                options={[
                  { value: 'public', content: t('Сообществу', 'Community') },
                  { value: 'private', content: t('Только мне', 'Only me') },
                  { value: 'draft', content: t('Черновик', 'Draft') },
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
              {publishMode === 'draft'
                ? t('Сохранить черновик', 'Save draft')
                : t('Опубликовать', 'Publish')}
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
                <img
                  src={media.url}
                  alt={t('Изображение для публикации', 'Post image')}
                />
              ) : null}
              <button
                type="button"
                className="feed-composer__media-remove"
                onClick={() => handleRemoveMedia(index)}
              >
                {t('Удалить', 'Delete')}
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
        aria-label={t('Написать публикацию', 'Write a post')}
        onClick={() => setComposerOpen(true)}
      >
        <Icon data={Plus} size={20} />
      </Button>
      {composerOpen && (
        <ContentDialog
          title={t('Новая публикация', 'New post')}
          busy={isCreatingNews || uploading}
          onClose={() => setComposerOpen(false)}
        >
          {editor}
        </ContentDialog>
      )}
    </>
  );
};
