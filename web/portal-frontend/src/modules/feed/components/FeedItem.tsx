/**
 * FeedItem Component
 *
 * Renders a single activity event in the feed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DropdownMenu,
  Icon,
  Label,
  Select,
  Text,
  TextArea,
  type DropdownMenuItem,
} from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare } from '@gravity-ui/icons';
import type { ActivityEvent, NewsMediaItem, NewsPayload } from '../../../types/activity';
import { createNewsComment, deleteNews, reactToNews, updateNews } from '../../../api/activity';
import { getEventMeta } from '../utils';
import { MarkdownPreview } from '../../../features/events/components/MarkdownPreview';
import { useAuth } from '../../../contexts/AuthContext';
import { activityKeys } from '../../../hooks/useActivity';
import { useQueryClient } from '@tanstack/react-query';
import { notifyApiError } from '../../../utils/apiErrorHandling';

const YOUTUBE_REGEX = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/gi;
const TAG_REGEX = /#([\p{L}\p{N}_-]{2,})/gu;
const TITLE_REGEX = /^#\s+(.+)$/m;

const getNewsPayload = (item: ActivityEvent): NewsPayload | null => {
  if (item.type !== 'news.posted') return null;
  if (!item.payloadJson || typeof item.payloadJson !== 'object') return null;
  const payload = item.payloadJson as Partial<NewsPayload>;
  if (!payload.body) return null;
  return {
    news_id: typeof payload.news_id === 'string' ? payload.news_id : undefined,
    title: payload.title ?? null,
    body: payload.body,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    media: Array.isArray(payload.media) ? (payload.media as NewsMediaItem[]) : [],
    comments_count: typeof payload.comments_count === 'number' ? payload.comments_count : undefined,
    reactions_count: typeof payload.reactions_count === 'number' ? payload.reactions_count : undefined,
  };
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const extractYoutubeIds = (markup: string) => {
  const ids = new Set<string>();
  const matches = markup.matchAll(YOUTUBE_REGEX);
  for (const match of matches) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
};

const extractTags = (markup: string) => {
  const withoutTitle = markup.replace(TITLE_REGEX, '');
  const tags = new Set<string>();
  const matches = withoutTitle.matchAll(TAG_REGEX);
  for (const match of matches) {
    const tag = match[1]?.toLowerCase();
    if (tag) tags.add(tag);
  }
  return Array.from(tags);
};

const extractTitle = (markup: string) => {
  const match = markup.match(TITLE_REGEX);
  return match?.[1]?.trim() ?? '';
};

export interface FeedItemProps {
  item: ActivityEvent;
  showPayload?: boolean;
  compact?: boolean;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  item,
  showPayload = true,
  compact = false,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const meta = getEventMeta(item.type);
  const dateStr = formatTimestamp(item.occurredAt);
  const news = getNewsPayload(item);
  const fallbackYoutube = useMemo(() => {
    if (!news || (news.media && news.media.length > 0)) return [];
    const ids = extractYoutubeIds(news.body);
    return ids.map<NewsMediaItem>((id) => ({
      type: 'youtube',
      url: `https://youtu.be/${id}`,
      video_id: id,
    }));
  }, [news]);
  const mediaItems = news?.media && news.media.length > 0 ? news.media : fallbackYoutube;
  const [localReactions, setLocalReactions] = useState<Record<string, number> | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentCount, setCommentCount] = useState<number | null>(
    typeof news?.comments_count === 'number' ? news.comments_count : null,
  );
  const [preview, setPreview] = useState<{ src: string; author: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editBody, setEditBody] = useState(news?.body ?? '');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private' | 'community' | 'team'>(
    (item.visibility as 'public' | 'private' | 'community' | 'team') ?? 'public',
  );
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const newsId = news?.news_id;
  const canManage = Boolean(
    newsId &&
      user &&
      (user.isSuperuser ||
        user.id === item.actorUserId ||
        user.capabilities?.includes('activity.news.manage')),
  );
  const reactionsTotal = useMemo(() => {
    if (localReactions) {
      return Object.values(localReactions).reduce((acc, value) => acc + value, 0);
    }
    return typeof news?.reactions_count === 'number' ? news.reactions_count : 0;
  }, [localReactions, news?.reactions_count]);

  const handleReaction = async (emoji: string) => {
    if (!newsId) return;
    const result = await reactToNews(newsId, { emoji, action: 'add' });
    const map: Record<string, number> = {};
    result.forEach((row) => {
      map[row.emoji] = row.count;
    });
    setLocalReactions(map);
  };

  const handleCommentSubmit = async () => {
    if (!newsId) return;
    const trimmed = commentBody.trim();
    if (!trimmed) return;
    await createNewsComment(newsId, trimmed);
    setCommentBody('');
    setCommentOpen(false);
    setCommentCount((prev) => (typeof prev === 'number' ? prev + 1 : 1));
  };

  useEffect(() => {
    if (news?.body) {
      setEditBody(news.body);
    }
  }, [news?.body]);

  useEffect(() => {
    if (item.visibility) {
      setEditVisibility(item.visibility as 'public' | 'private' | 'community' | 'team');
    }
  }, [item.visibility]);

  const handleEditSave = async () => {
    if (!newsId) return;
    const trimmed = editBody.trim();
    if (!trimmed) return;

    const title = extractTitle(trimmed);
    const tags = extractTags(trimmed);
    const youtubeIds = extractYoutubeIds(trimmed);
    const imageMedia = (news?.media ?? []).filter((m) => m.type === 'image');
    const youtubeMedia: NewsMediaItem[] = youtubeIds.map((id) => ({
      type: 'youtube',
      url: `https://youtu.be/${id}`,
      video_id: id,
    }));
    const media = [...imageMedia, ...youtubeMedia];

    setEditSaving(true);
    try {
      await updateNews(newsId, {
        title: title || undefined,
        body: trimmed,
        tags,
        visibility: editVisibility,
        media,
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.feed() });
      queryClient.invalidateQueries({ queryKey: activityKeys.feedInfinite() });
      setEditOpen(false);
    } catch (err) {
      notifyApiError(err, 'Не удалось обновить новость');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!newsId) return;
    setDeleteSaving(true);
    try {
      await deleteNews(newsId);
      queryClient.invalidateQueries({ queryKey: activityKeys.feed() });
      queryClient.invalidateQueries({ queryKey: activityKeys.feedInfinite() });
      setDeleteOpen(false);
    } catch (err) {
      notifyApiError(err, 'Не удалось удалить новость');
    } finally {
      setDeleteSaving(false);
    }
  };

  const manageItems = useMemo<DropdownMenuItem[]>(
    () => [
      {
        text: 'Редактировать',
        action: () => setEditOpen(true),
      },
      {
        text: 'Удалить',
        action: () => setDeleteOpen(true),
        theme: 'danger',
      },
    ],
    [setDeleteOpen, setEditOpen],
  );

  const authorLabel = item.actorUserId || 'Автор';
  const title = news?.title ?? item.title;

  const body = (
    <div
      className={[
        'feed-item',
        compact ? 'feed-item--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="feed-item__icon" aria-hidden="true">
        {meta.icon}
      </div>
      <div className="feed-item__content">
        <div className="feed-item__header">
          <Text variant="subheader-2" className="feed-item__author">
            {authorLabel}
          </Text>
          <Text variant="body-2" color="secondary">
            {dateStr}
          </Text>
          {item.scopeType && (
            <Text variant="body-2" color="secondary">
              {item.scopeType}
            </Text>
          )}
          <Label theme={meta.theme} size={compact ? 'xs' : 's'}>
            {meta.label}
          </Label>
          {canManage && (
            <div className="feed-item__header-actions">
              <DropdownMenu
                items={manageItems}
                renderSwitcher={(props) => (
                  <Button {...props} view="flat" size="s" className="feed-item__menu">
                    ⋯
                  </Button>
                )}
              />
            </div>
          )}
        </div>

        <Text variant={compact ? 'body-2' : 'subheader-2'} className="feed-item__title">
          {title}
        </Text>

        {news && (
          <div className="feed-item__news">
            <MarkdownPreview markup={news.body} className="feed-item__news-body" />
            {news.tags.length > 0 && (
              <div className="feed-item__news-tags">
                {news.tags.map((tag) => (
                  <span key={tag} className="feed-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {mediaItems && mediaItems.length > 0 && (
              <div className="feed-item__news-media">
                {mediaItems.map((media, index) => {
                  if (media.type === 'image' && media.url) {
                    return (
                      <button
                        key={`${media.key}-${index}`}
                        type="button"
                        className="feed-media feed-media--image"
                        onClick={() => setPreview({ src: media.url!, author: authorLabel })}
                      >
                        <img src={media.url} alt={media.caption ?? 'news media'} loading="lazy" />
                      </button>
                    );
                  }
                  if (media.type === 'youtube') {
                    const thumb = `https://img.youtube.com/vi/${media.video_id}/hqdefault.jpg`;
                    const link = media.url || `https://youtu.be/${media.video_id}`;
                    return (
                      <a
                        key={`${media.video_id}-${index}`}
                        className="feed-media feed-media--youtube"
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={thumb} alt={media.title ?? 'YouTube'} loading="lazy" />
                        <div className="feed-media__youtube">
                          <span>Смотреть видео</span>
                          <Icon data={ArrowUpRightFromSquare} size={14} />
                        </div>
                      </a>
                    );
                  }
                  return null;
                })}
              </div>
            )}
            <div className="feed-item__meta">
              <Text variant="caption-2" color="secondary">{item.visibility}</Text>
              <Text variant="caption-2" color="secondary">{item.scopeType}</Text>
              {item.sourceRef && (
                <Text variant="caption-2" color="secondary">{item.sourceRef}</Text>
              )}
            </div>
            <div className="feed-item__news-actions">
              <div className="feed-item__news-reactions">
                {['👍', '🔥', '❤️', '😂'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="feed-reaction"
                    onClick={() => handleReaction(emoji)}
                  >
                    <span>{emoji}</span>
                  </button>
                ))}
                <span className="feed-reaction__count">{reactionsTotal}</span>
              </div>
              <button type="button" className="feed-comment-toggle" onClick={() => setCommentOpen((prev) => !prev)}>
                Комментарии {typeof commentCount === 'number' ? `(${commentCount})` : ''}
              </button>
            </div>
            {commentOpen && (
              <div className="feed-comment-box">
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Написать комментарий..."
                  rows={2}
                />
                <button type="button" className="feed-comment-submit" onClick={handleCommentSubmit}>
                  Отправить
                </button>
              </div>
            )}
          </div>
        )}

        {showPayload && !news && item.payloadJson && Object.keys(item.payloadJson).length > 0 && (
          <div className="feed-item__payload">
            <pre>{JSON.stringify(item.payloadJson, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );

  if (compact) {
    return body;
  }

  return (
    <>
      <Card view="filled" className="feed-item__card">
        {body}
      </Card>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)}>
        <div className="feed-media-modal">
          {preview && <img src={preview.src} alt="full" />}
          {preview && (
            <div className="feed-media-modal__footer">
              <Text variant="caption-2" color="secondary">{preview.author}</Text>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} size="l" aria-label="Редактировать новость">
        <Dialog.Header caption="Редактировать новость" />
        <Dialog.Body>
          <div className="feed-item__edit">
            <TextArea
              value={editBody}
              onUpdate={setEditBody}
              minRows={6}
              placeholder="Измените текст новости"
            />
            <Select
              value={[editVisibility]}
              onUpdate={(values) => {
                const next = values[0] as 'public' | 'private' | 'community' | 'team' | undefined;
                if (next) setEditVisibility(next);
              }}
              options={[
                { value: 'public', content: 'Публично' },
                { value: 'community', content: 'Комьюнити' },
                { value: 'team', content: 'Команда' },
                { value: 'private', content: 'Только мне' },
              ]}
            />
            <Text variant="caption-2" color="secondary">
              Теги и YouTube-видео обновляются автоматически из текста. Изображения сохраняются.
            </Text>
          </div>
        </Dialog.Body>
        <Dialog.Footer
          actions={
            <>
              <Button view="flat" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
              <Button view="action" loading={editSaving} onClick={handleEditSave}>
                Сохранить
              </Button>
            </>
          }
        />
      </Dialog>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} aria-label="Удалить новость">
        <Dialog.Header caption="Удалить новость?" />
        <Dialog.Body>
          <Text variant="body-2">
            Новость будет удалена навсегда. Это действие нельзя отменить.
          </Text>
        </Dialog.Body>
        <Dialog.Footer
          actions={
            <>
              <Button view="flat" onClick={() => setDeleteOpen(false)}>
                Отмена
              </Button>
              <Button view="flat-danger" loading={deleteSaving} onClick={handleDelete}>
                Удалить
              </Button>
            </>
          }
        />
      </Dialog>
    </>
  );
};
