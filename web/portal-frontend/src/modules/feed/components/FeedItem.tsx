import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  DropdownMenu,
  Icon,
  Label,
  Loader,
  Select,
  Text,
  TextArea,
  Tooltip,
  type DropdownMenuItem,
} from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare, Lock, LockOpen } from '@gravity-ui/icons';
import { Link } from 'react-router-dom';

import { useRouteBase } from '@/shared/hooks/useRouteBase';
import type { ActivityEvent, NewsMediaItem, NewsPayload } from '../../../types/activity';
import {
  createNewsComment,
  deleteNews,
  deleteNewsComment,
  likeNewsComment,
  listNewsCommentsPage,
  listNewsReactions,
  reactToNews,
  type NewsCommentDetail,
  type NewsCommentsPage,
  type NewsReactionDetail,
  updateNews,
} from '../../../api/activity';
import { getEventMeta } from '../utils';
import { MarkdownPreview } from '../../../features/events/components/MarkdownPreview';
import { useAuth } from '../../../contexts/AuthContext';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { toaster } from '../../../toaster';
import type { FeedAuthorProfile } from '../types';

const YOUTUBE_REGEX = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/gi;
const TAG_REGEX = /#([\p{L}\p{N}_-]{2,})/gu;
const TITLE_REGEX = /^#\s+(.+)$/m;
const REACTION_EMOJIS = ['👍', '🔥', '❤️', '😂'];

const VISIBILITY_LABELS: Record<ActivityEvent['visibility'], { icon: unknown; label: string }> = {
  public: { icon: LockOpen, label: 'Публично' },
  private: { icon: Lock, label: 'Приватно' },
  community: { icon: Lock, label: 'Сообщество' },
  team: { icon: Lock, label: 'Команда' },
};

type CommentNode = NewsCommentDetail & { children: CommentNode[] };

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

const formatAbsoluteTimestamp = (value?: string | null, locale = 'ru-RU') => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const formatRelativeTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'только что';

  const diffMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.max(1, Math.ceil(diffMinutes / 60));
  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  const diffDays = Math.max(1, Math.ceil(diffHours / 24));
  return `${diffDays} дн назад`;
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'U';
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

const getReactionSummary = (rows: NewsReactionDetail[]) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(row.emoji, (map.get(row.emoji) ?? 0) + 1);
  });

  const known = REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: map.get(emoji) ?? 0,
  }));

  const extra = Array.from(map.entries())
    .filter(([emoji]) => !REACTION_EMOJIS.includes(emoji))
    .map(([emoji, count]) => ({ emoji, count }));

  return [...known, ...extra];
};

const compareByCreatedAtAsc = (a: { created_at: string }, b: { created_at: string }) => {
  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
  return aTime - bTime;
};

const normalizeComments = (rows: NewsCommentDetail[]) => [...rows].sort(compareByCreatedAtAsc);

const upsertComment = (rows: NewsCommentDetail[], next: NewsCommentDetail) => {
  const idx = rows.findIndex((row) => row.id === next.id);
  if (idx === -1) {
    return normalizeComments([...rows, next]);
  }
  const copy = [...rows];
  copy[idx] = next;
  return normalizeComments(copy);
};

const mergeComments = (rows: NewsCommentDetail[], incoming: NewsCommentDetail[]) => {
  if (incoming.length === 0) return rows;
  let next = [...rows];
  incoming.forEach((comment) => {
    next = upsertComment(next, comment);
  });
  return next;
};

const buildCommentTree = (rows: NewsCommentDetail[]): CommentNode[] => {
  const sorted = normalizeComments(rows);
  const map = new Map<number, CommentNode>();

  sorted.forEach((row) => {
    map.set(row.id, { ...row, children: [] });
  });

  const roots: CommentNode[] = [];
  sorted.forEach((row) => {
    const node = map.get(row.id);
    if (!node) return;

    const parentId = row.parent_id ?? null;
    if (typeof parentId === 'number') {
      const parent = map.get(parentId);
      if (parent) {
        parent.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  const sortChildren = (items: CommentNode[]) => {
    items.sort(compareByCreatedAtAsc);
    items.forEach((item) => sortChildren(item.children));
  };
  sortChildren(roots);

  return roots;
};

export interface FeedItemProps {
  item: ActivityEvent;
  showPayload?: boolean;
  compact?: boolean;
  authorProfiles?: Record<string, FeedAuthorProfile>;
  requestProfiles?: (userIds: string[]) => void;
  onDeleted?: (itemId: number) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  item,
  showPayload = true,
  compact = false,
  authorProfiles,
  requestProfiles,
  onDeleted,
}) => {
  const { user } = useAuth();
  const routeBase = useRouteBase();
  const locale = user?.language?.toLowerCase().startsWith('ru') ? 'ru-RU' : 'en-US';

  const [displayItem, setDisplayItem] = useState(item);
  const [preview, setPreview] = useState<{ src: string; author: string } | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private' | 'community' | 'team'>(
    (item.visibility as 'public' | 'private' | 'community' | 'team') ?? 'public',
  );
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [commentOpen, setCommentOpen] = useState(false);
  const [rootCommentBody, setRootCommentBody] = useState('');
  const [comments, setComments] = useState<NewsCommentDetail[]>([]);
  const [commentRootLoaded, setCommentRootLoaded] = useState(false);
  const [commentRootLoading, setCommentRootLoading] = useState(false);
  const [commentRootCursor, setCommentRootCursor] = useState<string | null>(null);
  const [commentRootHasMore, setCommentRootHasMore] = useState(false);
  const [replyLoadedByParent, setReplyLoadedByParent] = useState<Record<number, boolean>>({});
  const [replyCursorByParent, setReplyCursorByParent] = useState<Record<number, string | null>>({});
  const [replyHasMoreByParent, setReplyHasMoreByParent] = useState<Record<number, boolean>>({});
  const [replyLoadingFor, setReplyLoadingFor] = useState<number | null>(null);
  const [rootCommentSubmitting, setRootCommentSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyOpenFor, setReplyOpenFor] = useState<number | null>(null);
  const [replySubmittingFor, setReplySubmittingFor] = useState<number | null>(null);
  const [commentLikePendingFor, setCommentLikePendingFor] = useState<number | null>(null);
  const [commentDeletePendingFor, setCommentDeletePendingFor] = useState<number | null>(null);

  const [reactionRows, setReactionRows] = useState<NewsReactionDetail[]>([]);
  const [reactionLoaded, setReactionLoaded] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [reactionPendingEmoji, setReactionPendingEmoji] = useState<string | null>(null);
  const [reactionDetailsOpen, setReactionDetailsOpen] = useState(false);

  useEffect(() => {
    setDisplayItem(item);
    setIsDeleted(false);
  }, [item]);

  const meta = getEventMeta(displayItem.type);
  const news = getNewsPayload(displayItem);
  const newsId = news?.news_id;

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

  const [commentCount, setCommentCount] = useState<number>(news?.comments_count ?? 0);

  useEffect(() => {
    setCommentCount(news?.comments_count ?? 0);
  }, [news?.comments_count, displayItem.id]);

  useEffect(() => {
    setComments([]);
    setCommentRootLoaded(false);
    setCommentRootLoading(false);
    setCommentRootCursor(null);
    setCommentRootHasMore(false);
    setReplyLoadedByParent({});
    setReplyCursorByParent({});
    setReplyHasMoreByParent({});
    setReplyLoadingFor(null);
    setReplyOpenFor(null);
    setReplyDrafts({});
    setRootCommentBody('');
  }, [newsId]);

  useEffect(() => {
    setEditBody(news?.body ?? '');
  }, [news?.body]);

  useEffect(() => {
    setEditVisibility((displayItem.visibility as 'public' | 'private' | 'community' | 'team') ?? 'public');
  }, [displayItem.visibility]);

  const loadReactions = useCallback(async () => {
    if (!newsId) return;
    setReactionLoading(true);
    try {
      const rows = await listNewsReactions(newsId, 300);
      setReactionRows(rows);
      setReactionLoaded(true);
    } catch {
      setReactionLoaded(true);
    } finally {
      setReactionLoading(false);
    }
  }, [newsId]);

  useEffect(() => {
    if (!newsId) return;
    void loadReactions();
  }, [loadReactions, newsId]);

  const applyCommentsPage = useCallback(
    (page: NewsCommentsPage, parentId: number | null) => {
      setComments((prev) => mergeComments(prev, page.items));
      if (parentId === null) {
        setCommentRootCursor(page.next_cursor ?? null);
        setCommentRootHasMore(page.has_more);
        setCommentRootLoaded(true);
      } else {
        setReplyLoadedByParent((prev) => ({ ...prev, [parentId]: true }));
        setReplyCursorByParent((prev) => ({ ...prev, [parentId]: page.next_cursor ?? null }));
        setReplyHasMoreByParent((prev) => ({ ...prev, [parentId]: page.has_more }));
      }
    },
    [],
  );

  const loadRootCommentsPage = useCallback(
    async (cursor?: string | null) => {
      if (!newsId) return;
      setCommentRootLoading(true);
      try {
        const page = await listNewsCommentsPage(newsId, {
          parentId: null,
          limit: 30,
          cursor: cursor ?? null,
        });
        applyCommentsPage(page, null);
      } catch (err) {
        notifyApiError(err, 'Не удалось загрузить комментарии');
      } finally {
        setCommentRootLoading(false);
      }
    },
    [applyCommentsPage, newsId],
  );

  const loadReplyCommentsPage = useCallback(
    async (parentId: number, cursor?: string | null) => {
      if (!newsId) return;
      setReplyLoadingFor(parentId);
      try {
        const page = await listNewsCommentsPage(newsId, {
          parentId,
          limit: 20,
          cursor: cursor ?? null,
        });
        applyCommentsPage(page, parentId);
      } catch (err) {
        notifyApiError(err, 'Не удалось загрузить ответы');
      } finally {
        setReplyLoadingFor((prev) => (prev === parentId ? null : prev));
      }
    },
    [applyCommentsPage, newsId],
  );

  useEffect(() => {
    if (!commentOpen || commentRootLoaded || commentRootLoading || !newsId) return;
    void loadRootCommentsPage(null);
  }, [commentOpen, commentRootLoaded, commentRootLoading, loadRootCommentsPage, newsId]);

  useEffect(() => {
    if (!requestProfiles) return;

    const ids = [
      displayItem.actorUserId,
      ...reactionRows.map((row) => row.user_id),
      ...comments.map((comment) => comment.user_id),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length > 0) {
      requestProfiles(ids);
    }
  }, [comments, displayItem.actorUserId, reactionRows, requestProfiles]);

  const canManage = Boolean(
    newsId &&
      user &&
      (user.isSuperuser || user.id === displayItem.actorUserId || user.capabilities?.includes('activity.news.manage')),
  );

  const reactionSummary = useMemo(() => getReactionSummary(reactionRows), [reactionRows]);

  const myReactions = useMemo(
    () => new Set(reactionRows.filter((row) => row.user_id === user?.id).map((row) => row.emoji)),
    [reactionRows, user?.id],
  );

  const reactionsTotal = useMemo(() => {
    if (reactionLoaded) {
      return reactionRows.length;
    }
    return news?.reactions_count ?? 0;
  }, [news?.reactions_count, reactionLoaded, reactionRows.length]);

  const actorProfile = displayItem.actorUserId ? authorProfiles?.[displayItem.actorUserId] : undefined;
  const fallbackAuthor = displayItem.actorUserId || 'Система';
  const authorName = actorProfile?.displayName || (displayItem.actorUserId === user?.id ? user.displayName : fallbackAuthor);
  const authorUsername = actorProfile?.username || (displayItem.actorUserId === user?.id ? user.username : null);
  const authorAvatarUrl = actorProfile?.avatarUrl ?? (displayItem.actorUserId === user?.id ? user.avatarUrl ?? undefined : undefined);

  const currentUserProfile = useMemo(
    () =>
      user
        ? {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            firstName: '',
            lastName: '',
            avatarUrl: user.avatarUrl ?? null,
          }
        : null,
    [user],
  );

  const getProfileByUserId = useCallback(
    (userId: string) => {
      if (userId === currentUserProfile?.userId) {
        return currentUserProfile;
      }
      return authorProfiles?.[userId] ?? null;
    },
    [authorProfiles, currentUserProfile],
  );

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!newsId) return;
      const action = myReactions.has(emoji) ? 'remove' : 'add';
      setReactionPendingEmoji(emoji);
      try {
        await reactToNews(newsId, { emoji, action });
        await loadReactions();
      } catch (err) {
        notifyApiError(err, 'Не удалось обновить реакцию');
      } finally {
        setReactionPendingEmoji(null);
      }
    },
    [loadReactions, myReactions, newsId],
  );

  const addComment = useCallback(
    async (body: string, parentId?: number | null) => {
      if (!newsId) return;
      const trimmed = body.trim();
      if (!trimmed) return;

      if (typeof parentId === 'number') {
        setReplySubmittingFor(parentId);
      } else {
        setRootCommentSubmitting(true);
      }

      try {
        const created = await createNewsComment(newsId, trimmed, parentId ?? null);
        setComments((prev) => {
          let next = upsertComment(prev, created);
          if (typeof parentId === 'number') {
            next = next.map((row) =>
              row.id === parentId
                ? {
                    ...row,
                    replies_count: (row.replies_count ?? 0) + 1,
                  }
                : row,
            );
          }
          return next;
        });
        setCommentCount((prev) => prev + 1);
        if (parentId === null) {
          setCommentRootLoaded(true);
        } else {
          setReplyLoadedByParent((prev) => ({ ...prev, [parentId]: true }));
        }
        if (created.user_id && requestProfiles) {
          requestProfiles([created.user_id]);
        }
      } catch (err) {
        notifyApiError(err, 'Не удалось отправить комментарий');
      } finally {
        if (typeof parentId === 'number') {
          setReplySubmittingFor(null);
        } else {
          setRootCommentSubmitting(false);
        }
      }
    },
    [newsId, requestProfiles],
  );

  const handleRootCommentSubmit = useCallback(async () => {
    const draft = rootCommentBody;
    if (!draft.trim()) return;
    await addComment(draft, null);
    setRootCommentBody('');
  }, [addComment, rootCommentBody]);

  const handleReplySubmit = useCallback(
    async (commentId: number) => {
      const draft = (replyDrafts[commentId] ?? '').trim();
      if (!draft) return;
      await addComment(draft, commentId);
      setReplyDrafts((prev) => ({ ...prev, [commentId]: '' }));
      setReplyOpenFor(null);
    },
    [addComment, replyDrafts],
  );

  const handleToggleCommentLike = useCallback(
    async (comment: NewsCommentDetail) => {
      if (!newsId) return;
      setCommentLikePendingFor(comment.id);
      try {
        const response = await likeNewsComment(newsId, comment.id, {
          action: comment.my_liked ? 'remove' : 'add',
        });
        setComments((prev) =>
          prev.map((row) =>
            row.id === comment.id
              ? {
                  ...row,
                  likes_count: response.likes_count,
                  my_liked: response.my_liked,
                }
              : row,
          ),
        );
      } catch (err) {
        notifyApiError(err, 'Не удалось обновить лайк комментария');
      } finally {
        setCommentLikePendingFor(null);
      }
    },
    [newsId],
  );

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!newsId) return;
      setCommentDeletePendingFor(commentId);
      try {
        const deletedComment = await deleteNewsComment(newsId, commentId);
        setComments((prev) => prev.map((row) => (row.id === commentId ? deletedComment : row)));
      } catch (err) {
        notifyApiError(err, 'Не удалось удалить комментарий');
      } finally {
        setCommentDeletePendingFor(null);
      }
    },
    [newsId],
  );

  const handleEditSave = useCallback(async () => {
    if (!newsId) return;

    const trimmed = editBody.trim();
    if (!trimmed) return;

    const title = extractTitle(trimmed);
    const tags = extractTags(trimmed);
    const youtubeIds = extractYoutubeIds(trimmed);

    const imageMedia = (news?.media ?? []).filter((media): media is NewsMediaItem => media.type === 'image');
    const youtubeMedia: NewsMediaItem[] = youtubeIds.map((id) => ({
      type: 'youtube',
      url: `https://youtu.be/${id}`,
      video_id: id,
    }));

    setEditSaving(true);
    try {
      const updated = await updateNews(newsId, {
        title: title || undefined,
        body: trimmed,
        tags,
        visibility: editVisibility,
        media: [...imageMedia, ...youtubeMedia],
      });
      setDisplayItem(updated);
      setEditMode(false);
      setDeleteConfirmOpen(false);
    } catch (err) {
      notifyApiError(err, 'Не удалось обновить новость');
    } finally {
      setEditSaving(false);
    }
  }, [editBody, editVisibility, news?.media, newsId]);

  const handleDelete = useCallback(async () => {
    if (!newsId) return;

    setDeleteSaving(true);
    try {
      await deleteNews(newsId);
      setIsDeleted(true);
      onDeleted?.(displayItem.id);
    } catch (err) {
      notifyApiError(err, 'Не удалось удалить новость');
    } finally {
      setDeleteSaving(false);
    }
  }, [displayItem.id, newsId, onDeleted]);

  const handleShare = useCallback(async () => {
    const anchorId = newsId ? `news-${newsId}` : `feed-item-${displayItem.id}`;
    const url = `${window.location.origin}${routeBase}/feed#${anchorId}`;

    try {
      await navigator.clipboard.writeText(url);
      toaster.add({
        name: `feed-share-${displayItem.id}`,
        title: 'Ссылка скопирована',
        content: 'Можно отправить ссылку на эту новость',
        theme: 'success',
      });
    } catch (err) {
      notifyApiError(err, 'Не удалось скопировать ссылку');
    }
  }, [displayItem.id, newsId, routeBase]);

  const manageItems = useMemo<DropdownMenuItem[]>(
    () => [
      {
        text: 'Редактировать',
        action: () => {
          setDeleteConfirmOpen(false);
          setEditMode(true);
        },
      },
      {
        text: 'Удалить',
        action: () => {
          setEditMode(false);
          setDeleteConfirmOpen(true);
        },
        theme: 'danger',
      },
    ],
    [],
  );

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const loadedRepliesCountByParent = useMemo(() => {
    const map = new Map<number, number>();
    comments.forEach((comment) => {
      if (typeof comment.parent_id === 'number') {
        map.set(comment.parent_id, (map.get(comment.parent_id) ?? 0) + 1);
      }
    });
    return map;
  }, [comments]);

  const renderCommentNode = (node: CommentNode, depth: number): React.ReactNode => {
    const isDeletedNode = node.deleted === true;
    const profile = node.user_id ? getProfileByUserId(node.user_id) : null;
    const username = isDeletedNode ? null : profile?.username ?? null;
    const displayName = isDeletedNode ? '—' : profile?.displayName || node.user_id || '—';

    const canDeleteNode =
      !isDeletedNode &&
      Boolean(node.user_id && user && (node.user_id === user.id || canManage));

    const likeCount = node.likes_count ?? 0;
    const likedByMe = node.my_liked === true;
    const likePending = commentLikePendingFor === node.id;
    const deletePending = commentDeletePendingFor === node.id;
    const replyPending = replySubmittingFor === node.id;
    const childPageLoading = replyLoadingFor === node.id;
    const loadedChildren = loadedRepliesCountByParent.get(node.id) ?? 0;
    const knownChildren = node.replies_count ?? 0;
    const hasMoreChildren = replyHasMoreByParent[node.id] === true;
    const wasLoaded = replyLoadedByParent[node.id] === true;
    const canLoadChildren = knownChildren > loadedChildren || hasMoreChildren || (!wasLoaded && knownChildren > 0);
    const replyOpen = replyOpenFor === node.id;
    const replyDraft = replyDrafts[node.id] ?? '';

    return (
      <div
        key={node.id}
        className="feed-comment-tree__node"
        style={{ marginLeft: `${Math.min(depth, 8) * 18}px` }}
      >
        <div className={["feed-comment-tree__card", isDeletedNode ? 'is-deleted' : ''].filter(Boolean).join(' ')}>
          <div className="feed-comment-tree__header">
            <div className="feed-comment-tree__meta">
              <Avatar
                size="s"
                text={isDeletedNode ? '—' : getInitials(displayName)}
                imgUrl={!isDeletedNode ? profile?.avatarUrl ?? undefined : undefined}
              />
              {username ? (
                <Link to={`${routeBase}/profile/user/${encodeURIComponent(username)}`} className="feed-item__author-link">
                  <Text variant="caption-2">{displayName}</Text>
                </Link>
              ) : (
                <Text variant="caption-2">{displayName}</Text>
              )}
            </div>
            <Tooltip content={formatAbsoluteTimestamp(node.created_at, locale)}>
              <span className="feed-item__time feed-item__time--small">
                {formatRelativeTimestamp(node.created_at)}
              </span>
            </Tooltip>
          </div>

          <Text variant="body-2" color={isDeletedNode ? 'secondary' : 'primary'}>
            {node.body}
          </Text>

          <div className="feed-comment-tree__actions">
            <button
              type="button"
              className="feed-comment-toggle"
              disabled={likePending || isDeletedNode}
              onClick={() => void handleToggleCommentLike(node)}
            >
              {likedByMe ? 'Убрать лайк' : 'Нравится'} ({likeCount})
            </button>
            <button
              type="button"
              className="feed-comment-toggle"
              disabled={replyPending}
              onClick={() => setReplyOpenFor((prev) => (prev === node.id ? null : node.id))}
            >
              Ответить
            </button>
            {canLoadChildren && (
              <button
                type="button"
                className="feed-comment-toggle"
                disabled={childPageLoading}
                onClick={() =>
                  void loadReplyCommentsPage(
                    node.id,
                    wasLoaded ? (replyCursorByParent[node.id] ?? null) : null,
                  )
                }
              >
                {childPageLoading
                  ? 'Загрузка...'
                  : hasMoreChildren || loadedChildren < knownChildren
                    ? `Показать ответы (${Math.max(knownChildren - loadedChildren, 1)})`
                    : 'Показать ответы'}
              </button>
            )}
            {canDeleteNode && (
              <button
                type="button"
                className="feed-comment-toggle"
                disabled={deletePending}
                onClick={() => void handleDeleteComment(node.id)}
              >
                Удалить
              </button>
            )}
          </div>

          {replyOpen && (
            <div className="feed-comment-tree__reply">
              <textarea
                value={replyDraft}
                onChange={(event) =>
                  setReplyDrafts((prev) => ({
                    ...prev,
                    [node.id]: event.target.value,
                  }))
                }
                rows={2}
                placeholder="Ответить на комментарий..."
              />
              <div className="feed-comment-box__actions">
                <Button view="flat" size="m" onClick={() => setReplyOpenFor(null)}>
                  Отмена
                </Button>
                <Button
                  view="action"
                  size="m"
                  loading={replyPending}
                  disabled={!replyDraft.trim()}
                  onClick={() => void handleReplySubmit(node.id)}
                >
                  Ответить
                </Button>
              </div>
            </div>
          )}
        </div>

        {node.children.length > 0 && (
          <div className="feed-comment-tree__children">
            {node.children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isDeleted) {
    return null;
  }

  const title = news?.title ?? displayItem.title;
  const visibility = VISIBILITY_LABELS[displayItem.visibility] ?? VISIBILITY_LABELS.public;
  const absoluteTime = formatAbsoluteTimestamp(displayItem.occurredAt, locale);
  const relativeTime = formatRelativeTimestamp(displayItem.occurredAt);

  const isUserNews = displayItem.type === 'news.posted' && Boolean(displayItem.actorUserId);
  const showEventBadge = displayItem.type !== 'news.posted' || !displayItem.actorUserId;
  const eventBadgeLabel = displayItem.type === 'news.posted' && !displayItem.actorUserId ? 'Служебное' : meta.label;

  const anchorId = newsId ? `news-${newsId}` : `feed-item-${displayItem.id}`;

  const content = (
    <div className={['feed-item', compact ? 'feed-item--compact' : ''].filter(Boolean).join(' ')} id={anchorId}>
      <div className="feed-item__icon" aria-hidden="true">
        {isUserNews ? (
          <Avatar size="m" imgUrl={authorAvatarUrl} text={getInitials(authorName)} />
        ) : (
          meta.icon
        )}
      </div>

      <div className="feed-item__content">
        <div className="feed-item__header">
          <div className="feed-item__header-main">
            {authorUsername ? (
              <Link to={`${routeBase}/profile/user/${encodeURIComponent(authorUsername)}`} className="feed-item__author-link">
                <Text variant="subheader-2" className="feed-item__author">
                  {authorName}
                </Text>
              </Link>
            ) : (
              <Text variant="subheader-2" className="feed-item__author">
                {authorName}
              </Text>
            )}

            {authorUsername && (
              <Text variant="caption-2" color="secondary" className="feed-item__author-tag">
                @{authorUsername}
              </Text>
            )}
          </div>

          <div className="feed-item__header-right">
            <span className="feed-item__visibility" aria-label={`Видимость: ${visibility.label}`}>
              <Icon data={visibility.icon as never} size={12} />
              <span>{visibility.label}</span>
            </span>

            {showEventBadge && (
              <Label theme={displayItem.type === 'news.posted' ? 'warning' : meta.theme} size={compact ? 'xs' : 's'}>
                {eventBadgeLabel}
              </Label>
            )}

            <Tooltip content={absoluteTime}>
              <span className="feed-item__time feed-item__time--published">{relativeTime}</span>
            </Tooltip>

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
        </div>

        <Text variant={compact ? 'body-2' : 'subheader-2'} className="feed-item__title">
          {title}
        </Text>

        {news && (
          <div className="feed-item__news">
            {editMode ? (
              <div className="feed-item__edit">
                <TextArea value={editBody} onUpdate={setEditBody} minRows={5} placeholder="Измените текст новости" />
                <Select
                  value={[editVisibility]}
                  onUpdate={(values) => {
                    const next = values[0] as 'public' | 'private' | 'community' | 'team' | undefined;
                    if (next) setEditVisibility(next);
                  }}
                  options={[
                    { value: 'public', content: 'Публично' },
                    { value: 'community', content: 'Сообщество' },
                    { value: 'team', content: 'Команда' },
                    { value: 'private', content: 'Только мне' },
                  ]}
                />
                <div className="feed-item__inline-actions">
                  <Button view="flat" onClick={() => setEditMode(false)}>
                    Отмена
                  </Button>
                  <Button view="action" loading={editSaving} onClick={handleEditSave}>
                    Сохранить
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                            key={`${media.key ?? 'image'}-${index}`}
                            type="button"
                            className="feed-media feed-media--image"
                            onClick={() => setPreview({ src: media.url ?? '', author: authorName })}
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
              </>
            )}

            {deleteConfirmOpen && (
              <div className="feed-item__delete-inline">
                <Text variant="body-2">Новость будет удалена навсегда. Это действие нельзя отменить.</Text>
                <div className="feed-item__inline-actions">
                  <Button view="flat" onClick={() => setDeleteConfirmOpen(false)}>
                    Отмена
                  </Button>
                  <Button view="flat-danger" loading={deleteSaving} onClick={handleDelete}>
                    Удалить
                  </Button>
                </div>
              </div>
            )}

            <div className="feed-item__news-actions">
              <div className="feed-item__news-reactions">
                {reactionSummary.map((entry) => {
                  const isActive = myReactions.has(entry.emoji);
                  const isPending = reactionPendingEmoji === entry.emoji;
                  return (
                    <button
                      key={entry.emoji}
                      type="button"
                      className={['feed-reaction', isActive ? 'is-active' : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => void handleReaction(entry.emoji)}
                      disabled={isPending || !newsId}
                    >
                      <span>{entry.emoji}</span>
                      <span className="feed-reaction__count">{entry.count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="feed-item__news-tools">
                <button type="button" className="feed-comment-toggle" onClick={() => setCommentOpen((prev) => !prev)}>
                  Комментарии ({commentCount})
                </button>
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => setReactionDetailsOpen((prev) => !prev)}
                >
                  Реакции ({reactionsTotal})
                </button>
                <button type="button" className="feed-comment-toggle" onClick={() => void handleShare()}>
                  Поделиться
                </button>
              </div>
            </div>

            {reactionDetailsOpen && (
              <div className="feed-reaction-details">
                {reactionLoading ? (
                  <Loader size="s" />
                ) : reactionRows.length === 0 ? (
                  <Text variant="caption-2" color="secondary">
                    Пока нет реакций.
                  </Text>
                ) : (
                  reactionRows.map((row) => {
                    const profile = getProfileByUserId(row.user_id);
                    const displayName = profile?.displayName || row.user_id;
                    const username = profile?.username || null;
                    return (
                      <div key={`${row.id}-${row.created_at}`} className="feed-reaction-details__row">
                        <span className="feed-reaction-details__emoji">{row.emoji}</span>
                        <div className="feed-reaction-details__meta">
                          {username ? (
                            <Link to={`${routeBase}/profile/user/${encodeURIComponent(username)}`} className="feed-item__author-link">
                              <Text variant="caption-2">{displayName}</Text>
                            </Link>
                          ) : (
                            <Text variant="caption-2">{displayName}</Text>
                          )}
                          <Tooltip content={formatAbsoluteTimestamp(row.created_at, locale)}>
                            <span className="feed-item__time feed-item__time--small">
                              {formatRelativeTimestamp(row.created_at)}
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {commentOpen && (
              <div className="feed-comment-box">
                <div className="feed-comment-box__list feed-comment-tree">
                  {commentRootLoading && !commentRootLoaded ? (
                    <Loader size="s" />
                  ) : commentTree.length === 0 ? (
                    <Text variant="caption-2" color="secondary">
                      Пока нет комментариев.
                    </Text>
                  ) : (
                    <>
                      {commentTree.map((node) => renderCommentNode(node, 0))}
                      {commentRootHasMore && (
                        <button
                          type="button"
                          className="feed-comment-toggle"
                          disabled={commentRootLoading}
                          onClick={() => void loadRootCommentsPage(commentRootCursor)}
                        >
                          {commentRootLoading ? 'Загрузка...' : 'Показать ещё комментарии'}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <textarea
                  value={rootCommentBody}
                  onChange={(event) => setRootCommentBody(event.target.value)}
                  placeholder="Написать комментарий..."
                  rows={2}
                />
                <div className="feed-comment-box__actions">
                  <Button
                    view="action"
                    size="m"
                    loading={rootCommentSubmitting}
                    disabled={!rootCommentBody.trim()}
                    onClick={() => void handleRootCommentSubmit()}
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {showPayload && !news && displayItem.payloadJson && Object.keys(displayItem.payloadJson).length > 0 && (
          <div className="feed-item__payload">
            <pre>{JSON.stringify(displayItem.payloadJson, null, 2)}</pre>
          </div>
        )}
      </div>

      {preview && (
        <div className="feed-media-modal" role="dialog" aria-modal="true">
          <button type="button" className="feed-media-modal__backdrop" onClick={() => setPreview(null)} />
          <div className="feed-media-modal__card">
            <img src={preview.src} alt="full" />
            <div className="feed-media-modal__footer">
              <Text variant="caption-2" color="secondary">
                {preview.author}
              </Text>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card view="filled" className="feed-item__card">
      {content}
    </Card>
  );
};
