/**
 * FeedItem Component
 *
 * Renders a single activity event in the feed.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  DropdownMenu,
  Label,
  Loader,
  Select,
  Text,
  TextArea,
  type DropdownMenuItem,
} from '@gravity-ui/uikit';
import { useQueryClient } from '@tanstack/react-query';

import type {
  ActivityActorProfile,
  ActivityEvent,
  NewsMediaItem,
  NewsPayload,
  NewsReactionSummary,
} from '../../../types/activity';
import {
  createNewsComment,
  deleteNews,
  deleteNewsComment,
  likeNewsComment,
  listNewsCommentsPage,
  listNewsReactions,
  reactToNews,
  recordNewsView,
  updateNews,
  type NewsCommentDetail,
  type NewsReactionDetail,
} from '../../../api/activity';
import { useAuth } from '../../../contexts/AuthContext';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { MarkdownPreview } from '../../../features/events/components/MarkdownPreview';
import { getEventMeta } from '../utils';
import { extractTags, extractTitle, extractYoutubeIds, TITLE_REGEX } from '../utils/composer';
import { patchActivityFeedCaches, removeDraftItem, removeFeedNews, upsertDraftItem, upsertFeedItem } from '../cache';

const DEFAULT_REACTIONS = ['❤️', '😂', '🔥', '😍', '😮', '😡'] as const;

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
    status: payload.status === 'draft' ? 'draft' : 'published',
    permalink:
      payload.permalink && typeof payload.permalink === 'object'
        ? {
            news_id:
              typeof (payload.permalink as { news_id?: unknown }).news_id === 'string'
                ? (payload.permalink as { news_id: string }).news_id
                : (typeof payload.news_id === 'string' ? payload.news_id : ''),
            path:
              typeof (payload.permalink as { path?: unknown }).path === 'string'
                ? (payload.permalink as { path: string }).path
                : (typeof payload.news_id === 'string' ? `/feed/${payload.news_id}` : '/feed'),
          }
        : null,
    comments_count: typeof payload.comments_count === 'number' ? payload.comments_count : undefined,
    reactions_count: typeof payload.reactions_count === 'number' ? payload.reactions_count : undefined,
    views_count: typeof payload.views_count === 'number' ? payload.views_count : undefined,
    reaction_counts: Array.isArray(payload.reaction_counts)
      ? (payload.reaction_counts as NewsReactionSummary[])
      : [],
    my_reactions: Array.isArray(payload.my_reactions)
      ? payload.my_reactions.filter((value): value is string => typeof value === 'string')
      : [],
  };
};

const getVisibilityIndicator = (
  status: 'published' | 'draft' | undefined,
  visibility?: string | null,
): { emoji: string; tooltip: string } => {
  if (status === 'draft') {
    return {
      emoji: '📝',
      tooltip: 'Черновик: пост сохранён, но не опубликован для аудитории.',
    };
  }
  if (visibility === 'private') {
    return {
      emoji: '🔒',
      tooltip: 'Приватная публикация: пост виден только автору.',
    };
  }
  return {
    emoji: '🌍',
    tooltip: 'Публичная публикация: пост виден в общей ленте по выбранному scope.',
  };
};

const resolvePermalinkPath = (news: NewsPayload | null, newsId: string | null): string | null => {
  const raw = news?.permalink?.path || (newsId ? `/feed/${newsId}` : null);
  if (!raw) return null;

  if (raw.startsWith('/t/') || raw.startsWith('/app/')) {
    return raw;
  }
  if (typeof window === 'undefined') {
    return raw;
  }

  const path = window.location.pathname || '/';
  const tenantMatch = path.match(/^\/t\/([^/]+)/);
  if (tenantMatch?.[1]) {
    return `/t/${tenantMatch[1]}${raw}`;
  }
  if (path === '/app' || path.startsWith('/app/')) {
    return `/app${raw}`;
  }
  return raw;
};

const getDisplayName = (
  profile: ActivityActorProfile | null | undefined,
  fallbackId: string | null | undefined,
  currentUser?: { id: string; displayName: string } | null,
) => {
  if (fallbackId && currentUser?.id === fallbackId && currentUser.displayName.trim()) {
    return currentUser.displayName.trim();
  }
  const fullName = [profile?.first_name, profile?.last_name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
  return (
    fullName ||
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    fallbackId ||
    'Автор'
  );
};

const stripMarkdownHeading = (markup: string) => markup.replace(TITLE_REGEX, '').trim();

const mergeReactionSummary = (news: NewsPayload | null): NewsReactionSummary[] => {
  const myReactions = new Set(news?.my_reactions ?? []);
  const byEmoji = new Map<string, NewsReactionSummary>();

  for (const row of news?.reaction_counts ?? []) {
    byEmoji.set(row.emoji, {
      emoji: row.emoji,
      count: row.count,
      my_reacted: row.my_reacted ?? myReactions.has(row.emoji),
    });
  }

  for (const emoji of DEFAULT_REACTIONS) {
    if (!byEmoji.has(emoji)) {
      byEmoji.set(emoji, {
        emoji,
        count: 0,
        my_reacted: myReactions.has(emoji),
      });
    }
  }

  return Array.from(byEmoji.values());
};

const mergeComments = (current: NewsCommentDetail[], incoming: NewsCommentDetail[]): NewsCommentDetail[] => {
  const byId = new Map<number, NewsCommentDetail>();
  for (const item of current) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
};

const replaceCommentInList = (
  items: NewsCommentDetail[],
  commentId: number,
  updater: (comment: NewsCommentDetail) => NewsCommentDetail,
) => {
  let changed = false;
  const next = items.map((item) => {
    if (item.id !== commentId) return item;
    changed = true;
    return updater(item);
  });
  return changed ? next : items;
};

type CommentCollection = Record<number, NewsCommentDetail[]>;
type CommentFlags = Record<number, boolean>;
type CommentCursors = Record<number, string | null>;
type CommentText = Record<number, string>;

type FeedEventPayload = Record<string, unknown>;

const getNewsIdFromItem = (item: ActivityEvent): string | null => {
  const maybeId = item.payloadJson?.news_id;
  return typeof maybeId === 'string' ? maybeId : null;
};

const getMyReactionList = (summary: NewsReactionSummary[]) =>
  summary.filter((entry) => entry.my_reacted).map((entry) => entry.emoji);

export interface FeedItemProps {
  item: ActivityEvent;
  showPayload?: boolean;
  compact?: boolean;
  highlighted?: boolean;
  autoOpenComments?: boolean;
  moderationMode?: boolean;
  moderationSelected?: boolean;
  onModerationToggle?: (newsId: string, selected: boolean) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  item,
  showPayload = true,
  compact = false,
  highlighted = false,
  autoOpenComments = false,
  moderationMode = false,
  moderationSelected = false,
  onModerationToggle,
}) => {
  const { user } = useAuth();
  const { formatDateTime } = useFormatters();
  const queryClient = useQueryClient();
  const meta = getEventMeta(item.type);
  const dateStr = formatDateTime(item.occurredAt);
  const news = useMemo(() => getNewsPayload(item), [item]);
  const initialReactionSummary = useMemo(() => mergeReactionSummary(news), [news]);
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

  const [reactionSummary, setReactionSummary] = useState<NewsReactionSummary[]>(initialReactionSummary);
  const [commentOpen, setCommentOpen] = useState(Boolean(autoOpenComments));
  const [commentBody, setCommentBody] = useState('');
  const [commentCount, setCommentCount] = useState<number>(news?.comments_count ?? 0);
  const [viewCount, setViewCount] = useState<number>(news?.views_count ?? 0);
  const [preview, setPreview] = useState<{ src: string; author: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editBody, setEditBody] = useState(news?.body ?? '');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private' | 'community' | 'team'>(
    (item.visibility as 'public' | 'private' | 'community' | 'team') ?? 'public',
  );
  const [editStatus, setEditStatus] = useState<'published' | 'draft'>(news?.status ?? 'published');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [reactionDialogOpen, setReactionDialogOpen] = useState(false);
  const [reactionDialogFilter, setReactionDialogFilter] = useState<string>('all');
  const [reactionDetails, setReactionDetails] = useState<NewsReactionDetail[]>([]);
  const [reactionDetailsLoading, setReactionDetailsLoading] = useState(false);

  const [rootComments, setRootComments] = useState<NewsCommentDetail[]>([]);
  const [rootCursor, setRootCursor] = useState<string | null>(null);
  const [rootHasMore, setRootHasMore] = useState(false);
  const [loadingRootComments, setLoadingRootComments] = useState(false);
  const [rootLoaded, setRootLoaded] = useState(false);

  const [replyComments, setReplyComments] = useState<CommentCollection>({});
  const [replyExpanded, setReplyExpanded] = useState<CommentFlags>({});
  const [replyOpen, setReplyOpen] = useState<CommentFlags>({});
  const [replyLoading, setReplyLoading] = useState<CommentFlags>({});
  const [replySaving, setReplySaving] = useState<CommentFlags>({});
  const [replyCursors, setReplyCursors] = useState<CommentCursors>({});
  const [replyHasMore, setReplyHasMore] = useState<CommentFlags>({});
  const [replyBody, setReplyBody] = useState<CommentText>({});

  const [pendingCommentActions, setPendingCommentActions] = useState<CommentFlags>({});
  const [copyLinkState, setCopyLinkState] = useState<'idle' | 'done'>('idle');

  const itemRef = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef(false);

  const newsId = news?.news_id ?? null;
  const permalinkPath = useMemo(() => resolvePermalinkPath(news, newsId), [news, newsId]);
  const absolutePermalink = useMemo(() => {
    if (!permalinkPath || typeof window === 'undefined') return null;
    return new URL(permalinkPath, window.location.origin).toString();
  }, [permalinkPath]);

  const canManage = Boolean(
    newsId &&
      user &&
      (user.isSuperuser ||
        user.id === item.actorUserId ||
        user.capabilities?.includes('activity.news.manage')),
  );
  const reactionsTotal = useMemo(
    () => reactionSummary.reduce((acc, value) => acc + (value.count ?? 0), 0),
    [reactionSummary],
  );
  const activeReactions = useMemo(
    () => new Set(reactionSummary.filter((row) => row.my_reacted).map((row) => row.emoji)),
    [reactionSummary],
  );
  const authorLabel = getDisplayName(item.actorProfile, item.actorUserId, user);
  const authorAvatarUrl = item.actorUserId && user?.id === item.actorUserId ? user.avatarUrl : item.actorProfile?.avatar_url;
  const newsHeading = news ? extractTitle(news.body) || news.title?.trim() || '' : '';
  const newsBodyMarkup = news ? (newsHeading ? stripMarkdownHeading(news.body) : news.body.trim()) : '';
  const isModeratable = Boolean(newsId);
  const reactionDetailsFiltered = useMemo(
    () =>
      reactionDialogFilter === 'all'
        ? reactionDetails
        : reactionDetails.filter((row) => row.emoji === reactionDialogFilter),
    [reactionDetails, reactionDialogFilter],
  );
  const visibilityIndicator = useMemo(
    () => getVisibilityIndicator(news?.status, item.visibility),
    [item.visibility, news?.status],
  );

  const patchNewsPayloadInCache = useCallback(
    (updater: (payload: FeedEventPayload) => FeedEventPayload) => {
      if (!newsId) return;
      patchActivityFeedCaches(queryClient, (feedItem) => {
        const feedNewsId = getNewsIdFromItem(feedItem);
        if (!feedNewsId || feedNewsId !== newsId) return feedItem;
        const currentPayload = (feedItem.payloadJson ?? {}) as FeedEventPayload;
        const nextPayload = updater(currentPayload);
        return {
          ...feedItem,
          payloadJson: nextPayload,
        };
      });
    },
    [newsId, queryClient],
  );

  const patchCommentById = useCallback((commentId: number, updater: (item: NewsCommentDetail) => NewsCommentDetail) => {
    setRootComments((prev) => replaceCommentInList(prev, commentId, updater));
    setReplyComments((prev) => {
      let changed = false;
      const next: CommentCollection = {};
      for (const [parent, list] of Object.entries(prev)) {
        const updated = replaceCommentInList(list, commentId, updater);
        next[Number(parent)] = updated;
        if (updated !== list) {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const insertComment = useCallback((comment: NewsCommentDetail) => {
    if (typeof comment.parent_id === 'number') {
      const parentId = comment.parent_id;
      setReplyComments((prev) => ({
        ...prev,
        [parentId]: mergeComments(prev[parentId] ?? [], [comment]),
      }));
      patchCommentById(parentId, (parent) => ({
        ...parent,
        replies_count: Math.max((parent.replies_count ?? 0) + 1, 0),
      }));
      setReplyExpanded((prev) => ({ ...prev, [parentId]: true }));
      return;
    }

    setRootComments((prev) => mergeComments(prev, [comment]));
  }, [patchCommentById]);

  const replaceComment = useCallback((tempId: number, persisted: NewsCommentDetail) => {
    setRootComments((prev) => prev.map((item) => (item.id === tempId ? persisted : item)));
    setReplyComments((prev) => {
      let changed = false;
      const next: CommentCollection = {};
      for (const [parent, list] of Object.entries(prev)) {
        const mapped = list.map((item) => (item.id === tempId ? persisted : item));
        next[Number(parent)] = mapped;
        if (mapped !== list) {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const removeComment = useCallback((commentId: number) => {
    setRootComments((prev) => prev.filter((item) => item.id !== commentId));
    setReplyComments((prev) => {
      let changed = false;
      const next: CommentCollection = {};
      for (const [parent, list] of Object.entries(prev)) {
        const filtered = list.filter((item) => item.id !== commentId);
        next[Number(parent)] = filtered;
        if (filtered.length !== list.length) {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const loadRootComments = useCallback(
    async (reset = false) => {
      if (!newsId) return;
      if (loadingRootComments) return;
      setLoadingRootComments(true);
      try {
        const page = await listNewsCommentsPage(newsId, {
          parentId: null,
          limit: 8,
          cursor: reset ? null : rootCursor,
        });
        setRootComments((prev) => (reset ? page.items : mergeComments(prev, page.items)));
        setRootCursor(page.next_cursor);
        setRootHasMore(page.has_more);
        setRootLoaded(true);
      } catch (err) {
        notifyApiError(err, 'Не удалось загрузить комментарии');
      } finally {
        setLoadingRootComments(false);
      }
    },
    [loadingRootComments, newsId, rootCursor],
  );

  const loadReplies = useCallback(
    async (parentId: number, reset = false) => {
      if (!newsId) return;
      if (replyLoading[parentId]) return;
      setReplyLoading((prev) => ({ ...prev, [parentId]: true }));
      try {
        const page = await listNewsCommentsPage(newsId, {
          parentId,
          limit: 8,
          cursor: reset ? null : replyCursors[parentId] ?? null,
        });
        setReplyComments((prev) => ({
          ...prev,
          [parentId]: reset ? page.items : mergeComments(prev[parentId] ?? [], page.items),
        }));
        setReplyCursors((prev) => ({ ...prev, [parentId]: page.next_cursor }));
        setReplyHasMore((prev) => ({ ...prev, [parentId]: page.has_more }));
      } catch (err) {
        notifyApiError(err, 'Не удалось загрузить ответы');
      } finally {
        setReplyLoading((prev) => ({ ...prev, [parentId]: false }));
      }
    },
    [newsId, replyCursors, replyLoading],
  );

  const applyReactions = useCallback(
    (next: NewsReactionSummary[]) => {
      const normalized = mergeReactionSummary({
        body: news?.body ?? '',
        tags: news?.tags ?? [],
        reaction_counts: next,
        my_reactions: getMyReactionList(next),
      });
      const count = normalized.reduce((acc, row) => acc + (row.count ?? 0), 0);
      setReactionSummary(normalized);
      patchNewsPayloadInCache((payload) => ({
        ...payload,
        reaction_counts: normalized.map((row) => ({
          emoji: row.emoji,
          count: row.count,
          my_reacted: row.my_reacted,
        })),
        my_reactions: getMyReactionList(normalized),
        reactions_count: count,
      }));
    },
    [news?.body, news?.tags, patchNewsPayloadInCache],
  );

  const patchCommentCount = useCallback((updater: (value: number) => number) => {
    setCommentCount((prev) => {
      const next = Math.max(updater(prev), 0);
      patchNewsPayloadInCache((payload) => ({ ...payload, comments_count: next }));
      return next;
    });
  }, [patchNewsPayloadInCache]);

  useEffect(() => {
    setReactionSummary(initialReactionSummary);
  }, [initialReactionSummary]);

  useEffect(() => {
    if (news?.body) {
      setEditBody(news.body);
    }
  }, [news?.body]);

  useEffect(() => {
    setEditStatus(news?.status ?? 'published');
  }, [news?.status]);

  useEffect(() => {
    if (item.visibility) {
      setEditVisibility(item.visibility as 'public' | 'private' | 'community' | 'team');
    }
  }, [item.visibility]);

  useEffect(() => {
    setCommentCount(news?.comments_count ?? 0);
  }, [news?.comments_count]);

  useEffect(() => {
    setViewCount(news?.views_count ?? 0);
  }, [news?.views_count]);

  useEffect(() => {
    if (!newsId) return;
    setRootComments([]);
    setRootCursor(null);
    setRootHasMore(false);
    setRootLoaded(false);
    setReplyComments({});
    setReplyExpanded({});
    setReplyCursors({});
    setReplyHasMore({});
    setReplyBody({});
    setReplyOpen({});
    setPendingCommentActions({});
  }, [newsId]);

  useEffect(() => {
    if (!commentOpen) return;
    if (rootLoaded || loadingRootComments) return;
    void loadRootComments(true);
  }, [commentOpen, loadRootComments, loadingRootComments, rootLoaded]);

  useEffect(() => {
    if (!autoOpenComments) return;
    setCommentOpen(true);
  }, [autoOpenComments]);

  useEffect(() => {
    if (!newsId || !user?.id || typeof IntersectionObserver === 'undefined') return;
    if (viewTrackedRef.current) return;
    const element = itemRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55);
        if (!visible || viewTrackedRef.current) return;
        viewTrackedRef.current = true;
        setViewCount((prev) => prev + 1);
        patchNewsPayloadInCache((payload) => ({
          ...payload,
          views_count: Number(payload.views_count ?? 0) + 1,
        }));
        void recordNewsView(newsId)
          .then((result) => {
            setViewCount(result.views_count);
            patchNewsPayloadInCache((payload) => ({
              ...payload,
              views_count: result.views_count,
            }));
          })
          .catch(() => {
            viewTrackedRef.current = false;
            setViewCount((prev) => Math.max(prev - 1, 0));
            patchNewsPayloadInCache((payload) => ({
              ...payload,
              views_count: Math.max(Number(payload.views_count ?? 1) - 1, 0),
            }));
          });
      },
      { threshold: [0.55, 0.75] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [newsId, patchNewsPayloadInCache, user?.id]);

  useEffect(() => {
    if (!newsId || typeof window === 'undefined') return;
    const handleNewsUpsert = (event: Event) => {
      const custom = event as CustomEvent<{ newsId?: string }>;
      if (custom.detail?.newsId !== newsId) return;
      if (commentOpen) {
        void loadRootComments(true);
      }
    };
    window.addEventListener('activity:news-upsert', handleNewsUpsert as EventListener);
    return () => {
      window.removeEventListener('activity:news-upsert', handleNewsUpsert as EventListener);
    };
  }, [commentOpen, loadRootComments, newsId]);

  useEffect(() => {
    if (copyLinkState !== 'done') return;
    const timer = window.setTimeout(() => setCopyLinkState('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copyLinkState]);

  const refreshReactionDetails = async (nextFilter = reactionDialogFilter) => {
    if (!newsId) return;
    setReactionDialogFilter(nextFilter);
    setReactionDialogOpen(true);
    setReactionDetailsLoading(true);
    try {
      const details = await listNewsReactions(newsId, 200);
      setReactionDetails(details);
    } catch (err) {
      notifyApiError(err, 'Не удалось загрузить список реакций');
    } finally {
      setReactionDetailsLoading(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!newsId) return;
    const wasActive = activeReactions.has(emoji);
    const rollback = reactionSummary;
    const optimistic = reactionSummary.map((entry) => {
      if (entry.emoji !== emoji) return entry;
      const nextCount = wasActive ? Math.max((entry.count ?? 0) - 1, 0) : (entry.count ?? 0) + 1;
      return { ...entry, count: nextCount, my_reacted: !wasActive };
    });
    applyReactions(optimistic);

    try {
      const action = wasActive ? 'remove' : 'add';
      const result = await reactToNews(newsId, { emoji, action });
      const normalized = mergeReactionSummary({
        body: news?.body ?? '',
        tags: news?.tags ?? [],
        reaction_counts: result,
        my_reactions: result.filter((row) => row.my_reacted).map((row) => row.emoji),
      });
      applyReactions(normalized);
      if (reactionDialogOpen) {
        await refreshReactionDetails(reactionDialogFilter);
      }
    } catch (err) {
      applyReactions(rollback);
      notifyApiError(err, 'Не удалось обновить реакцию');
    }
  };

  const submitComment = async (parentId?: number) => {
    if (!newsId) return;
    const key = parentId ?? 0;
    const rawBody = parentId ? replyBody[parentId] ?? '' : commentBody;
    const trimmed = rawBody.trim();
    if (!trimmed) return;

    const tempId = -Date.now();
    const nowIso = new Date().toISOString();
    const optimisticComment: NewsCommentDetail = {
      id: tempId,
      user_id: user?.id ?? null,
      body: trimmed,
      created_at: nowIso,
      parent_id: parentId ?? null,
      deleted: false,
      likes_count: 0,
      my_liked: false,
      replies_count: 0,
      can_edit: true,
      can_delete: true,
      can_reply: true,
      user_profile: user
        ? {
            user_id: user.id,
            username: user.username,
            display_name: user.displayName,
            first_name: user.displayName,
            last_name: '',
            avatar_url: user.avatarUrl ?? null,
          }
        : null,
    };

    if (parentId) {
      setReplySaving((prev) => ({ ...prev, [key]: true }));
      setReplyBody((prev) => ({ ...prev, [parentId]: '' }));
    } else {
      setCommentBody('');
    }
    insertComment(optimisticComment);
    patchCommentCount((prev) => prev + 1);

    try {
      const created = await createNewsComment(newsId, trimmed, parentId ?? null);
      replaceComment(tempId, created);
      if (parentId) {
        setReplyOpen((prev) => ({ ...prev, [parentId]: false }));
      }
    } catch (err) {
      removeComment(tempId);
      patchCommentCount((prev) => Math.max(prev - 1, 0));
      if (parentId) {
        setReplyBody((prev) => ({ ...prev, [parentId]: trimmed }));
      } else {
        setCommentBody(trimmed);
      }
      notifyApiError(err, 'Не удалось отправить комментарий');
    } finally {
      if (parentId) {
        setReplySaving((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const handleCommentLike = async (comment: NewsCommentDetail) => {
    if (!newsId || comment.deleted) return;
    const action = comment.my_liked ? 'remove' : 'add';
    const optimisticLiked = !comment.my_liked;
    const optimisticCount = Math.max((comment.likes_count ?? 0) + (optimisticLiked ? 1 : -1), 0);
    setPendingCommentActions((prev) => ({ ...prev, [comment.id]: true }));
    patchCommentById(comment.id, (item) => ({
      ...item,
      my_liked: optimisticLiked,
      likes_count: optimisticCount,
    }));
    try {
      const result = await likeNewsComment(newsId, comment.id, { action });
      patchCommentById(comment.id, (item) => ({
        ...item,
        my_liked: result.my_liked,
        likes_count: result.likes_count,
      }));
    } catch (err) {
      patchCommentById(comment.id, (item) => ({
        ...item,
        my_liked: comment.my_liked,
        likes_count: comment.likes_count ?? 0,
      }));
      notifyApiError(err, 'Не удалось обновить лайк комментария');
    } finally {
      setPendingCommentActions((prev) => ({ ...prev, [comment.id]: false }));
    }
  };

  const handleCommentDelete = async (comment: NewsCommentDetail) => {
    if (!newsId || !comment.can_delete || comment.deleted) return;
    setPendingCommentActions((prev) => ({ ...prev, [comment.id]: true }));
    const previous = comment;
    patchCommentById(comment.id, (item) => ({
      ...item,
      deleted: true,
      body: 'Комментарий удалён',
      can_delete: false,
      can_edit: false,
      can_reply: false,
    }));
    try {
      const deleted = await deleteNewsComment(newsId, comment.id);
      patchCommentById(comment.id, () => deleted);
    } catch (err) {
      patchCommentById(comment.id, () => previous);
      notifyApiError(err, 'Не удалось удалить комментарий');
    } finally {
      setPendingCommentActions((prev) => ({ ...prev, [comment.id]: false }));
    }
  };

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
      const updated = await updateNews(newsId, {
        title: title || undefined,
        body: trimmed,
        tags,
        visibility: editStatus === 'draft' ? undefined : editVisibility,
        status: editStatus,
        media,
      });
      const updatedStatus = updated.payloadJson?.status;
      if (updatedStatus === 'draft') {
        upsertDraftItem(queryClient, updated);
        removeFeedNews(queryClient, newsId);
      } else {
        upsertFeedItem(queryClient, updated, { prependIfMissing: true });
        removeDraftItem(queryClient, newsId);
      }
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
      removeFeedNews(queryClient, newsId);
      removeDraftItem(queryClient, newsId);
      setDeleteOpen(false);
    } catch (err) {
      notifyApiError(err, 'Не удалось удалить новость');
    } finally {
      setDeleteSaving(false);
    }
  };

  const copyPermalink = useCallback(async () => {
    if (!absolutePermalink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolutePermalink);
      } else {
        const temp = document.createElement('textarea');
        temp.value = absolutePermalink;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopyLinkState('done');
    } catch {
      setCopyLinkState('idle');
    }
  }, [absolutePermalink]);

  const manageItems = useMemo<DropdownMenuItem[]>(() => {
    if (!canManage) {
      return [];
    }
    const items: DropdownMenuItem[] = [];
    if (absolutePermalink) {
      items.push({
        text: copyLinkState === 'done' ? 'Ссылка скопирована' : 'Скопировать ссылку',
        action: () => {
          void copyPermalink();
        },
      });
    }
    items.push({
      text: 'Редактировать',
      action: () => setEditOpen(true),
    });
    items.push({
      text: 'Удалить',
      action: () => setDeleteOpen(true),
      theme: 'danger',
    });
    return items;
  }, [absolutePermalink, canManage, copyLinkState, copyPermalink]);

  const renderCommentNode = useCallback(
    (comment: NewsCommentDetail, depth = 0): React.ReactNode => {
      const label = getDisplayName(comment.user_profile, comment.user_id, user);
      const avatarUrl = comment.user_id === user?.id ? user.avatarUrl : comment.user_profile?.avatar_url;
      const hasReplies = (comment.replies_count ?? 0) > 0;
      const isExpanded = replyExpanded[comment.id] === true;
      const children = replyComments[comment.id] ?? [];
      const isReplyBoxOpen = replyOpen[comment.id] === true;
      const isActionPending = pendingCommentActions[comment.id] === true;

      return (
        <div key={comment.id} className="feed-comment-tree__node" style={{ marginLeft: Math.min(depth, 4) * 14 }}>
          <div className={`feed-comment-tree__card${comment.deleted ? ' is-deleted' : ''}`}>
            <div className="feed-comment-tree__header">
              <div className="feed-comment-tree__meta">
                <Avatar size="s" imgUrl={avatarUrl ?? undefined} text={label} title={label} />
                <Text variant="body-2">{label}</Text>
                <Text variant="caption-2" color="secondary" className="feed-item__time--small">
                  {formatDateTime(comment.created_at)}
                </Text>
              </div>
            </div>
            <Text variant="body-2" color={comment.deleted ? 'secondary' : 'primary'}>
              {comment.body}
            </Text>
            <div className="feed-comment-tree__actions">
              <button
                type="button"
                className={`feed-reaction${comment.my_liked ? ' is-active' : ''}`}
                disabled={isActionPending || comment.deleted}
                title={comment.my_liked ? 'Нажмите, чтобы убрать лайк' : 'Поставить лайк'}
                onClick={() => void handleCommentLike(comment)}
              >
                <span>👍</span>
                <span className="feed-reaction__count">{comment.likes_count ?? 0}</span>
              </button>
              {comment.can_reply && !comment.deleted && (
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => {
                    setReplyOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }));
                  }}
                >
                  Ответить
                </button>
              )}
              {comment.can_delete && !comment.deleted && (
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => void handleCommentDelete(comment)}
                  disabled={isActionPending}
                >
                  Удалить
                </button>
              )}
              {hasReplies && (
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => {
                    const next = !isExpanded;
                    setReplyExpanded((prev) => ({ ...prev, [comment.id]: next }));
                    if (next && (replyComments[comment.id]?.length ?? 0) === 0) {
                      void loadReplies(comment.id, true);
                    }
                  }}
                >
                  {isExpanded ? 'Скрыть ответы' : `Показать ответы (${comment.replies_count ?? 0})`}
                </button>
              )}
            </div>

            {isReplyBoxOpen && (
              <div className="feed-comment-tree__reply">
                <textarea
                  value={replyBody[comment.id] ?? ''}
                  onChange={(event) =>
                    setReplyBody((prev) => ({ ...prev, [comment.id]: event.target.value }))
                  }
                  placeholder="Ответить на комментарий..."
                  rows={2}
                />
                <div className="feed-comment-box__actions">
                  <Button
                    view="normal"
                    size="s"
                    onClick={() => setReplyOpen((prev) => ({ ...prev, [comment.id]: false }))}
                  >
                    Отмена
                  </Button>
                  <Button
                    view="action"
                    size="s"
                    loading={replySaving[comment.id] === true}
                    disabled={!(replyBody[comment.id] ?? '').trim()}
                    onClick={() => void submitComment(comment.id)}
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="feed-comment-tree__children">
              {children.map((child) => renderCommentNode(child, depth + 1))}
              {replyLoading[comment.id] && (
                <div className="feed-reaction-roster__loading">
                  <Loader size="s" />
                </div>
              )}
              {replyHasMore[comment.id] && !replyLoading[comment.id] && (
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => void loadReplies(comment.id)}
                >
                  Показать ещё ответы
                </button>
              )}
            </div>
          )}
        </div>
      );
    },
    [
      handleCommentDelete,
      handleCommentLike,
      loadReplies,
      pendingCommentActions,
      replyBody,
      replyComments,
      replyExpanded,
      replyHasMore,
      replyLoading,
      replyOpen,
      replySaving,
      submitComment,
      user,
    ],
  );

  const body = (
    <div
      ref={itemRef}
      className={[
        'feed-item',
        compact ? 'feed-item--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="feed-item__icon" aria-hidden="true">
        {news ? (
          <Avatar
            size="l"
            imgUrl={authorAvatarUrl ?? undefined}
            text={authorLabel}
            title={authorLabel}
          />
        ) : (
          meta.icon
        )}
      </div>
      <div className="feed-item__content">
        <div className="feed-item__header">
          <div className="feed-item__header-main">
            <Text variant="subheader-2" className="feed-item__author">
              {authorLabel}
            </Text>
            <Label theme={meta.theme} size={compact ? 'xs' : 's'}>
              {meta.label}
            </Label>
            {moderationMode && isModeratable && (
              <label className="feed-item__moderation-check">
                <input
                  type="checkbox"
                  checked={moderationSelected}
                  onChange={(event) => {
                    if (!newsId || !onModerationToggle) return;
                    onModerationToggle(newsId, event.target.checked);
                  }}
                />
                <span>Выбрать</span>
              </label>
            )}
          </div>
          <div className="feed-item__header-right">
            {news && (
              <span
                className="feed-item__visibility"
                aria-label={visibilityIndicator.tooltip}
                title={visibilityIndicator.tooltip}
              >
                {visibilityIndicator.emoji}
              </span>
            )}
            <Text variant="body-2" color="secondary" className="feed-item__time feed-item__time--published">
              {dateStr}
            </Text>
            {!news && item.scopeType && (
              <Text variant="body-2" color="secondary">
                {item.scopeType}
              </Text>
            )}
            {manageItems.length > 0 && (
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

        {!news && (
          <Text variant={compact ? 'body-2' : 'subheader-2'} className="feed-item__title">
            {item.title}
          </Text>
        )}

        {news && (
          <div className="feed-item__news">
            {newsHeading ? (
              <Text variant={compact ? 'subheader-1' : 'header-2'} className="feed-item__title feed-item__title-highlight">
                {newsHeading}
              </Text>
            ) : null}
            {newsBodyMarkup ? (
              <MarkdownPreview markup={newsBodyMarkup} className="feed-item__news-body" />
            ) : null}
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
                        </div>
                      </a>
                    );
                  }
                  return null;
                })}
              </div>
            )}
            <div className="feed-item__news-actions">
              <div className="feed-item__news-reactions">
                {reactionSummary.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    className={`feed-reaction${reaction.my_reacted ? ' is-active' : ''}`}
                    onClick={() => void handleReaction(reaction.emoji)}
                    title={reaction.my_reacted ? 'Реакция установлена. Нажмите, чтобы убрать.' : 'Поставить реакцию'}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="feed-reaction__count">{reaction.count}</span>
                  </button>
                ))}
              </div>
              <div className="feed-item__news-tools">
                <button
                  type="button"
                  className="feed-comment-toggle"
                  onClick={() => void refreshReactionDetails('all')}
                  disabled={reactionsTotal === 0}
                >
                  Реакции {reactionsTotal}
                </button>
                <Text variant="caption-2" color="secondary">
                  Просмотры {viewCount}
                </Text>
                <button type="button" className="feed-comment-toggle" onClick={() => setCommentOpen((prev) => !prev)}>
                  Комментарии ({commentCount})
                </button>
              </div>
            </div>
            {commentOpen && (
              <div className="feed-comment-box">
                <div className="feed-comment-box__list">
                  {loadingRootComments && rootComments.length === 0 ? (
                    <div className="feed-reaction-roster__loading">
                      <Loader size="m" />
                    </div>
                  ) : rootComments.length === 0 ? (
                    <Text variant="body-2" color="secondary">
                      Пока нет комментариев.
                    </Text>
                  ) : (
                    <div className="feed-comment-tree">
                      {rootComments.map((comment) => renderCommentNode(comment, 0))}
                    </div>
                  )}
                  {rootHasMore && !loadingRootComments && (
                    <button type="button" className="feed-comment-toggle" onClick={() => void loadRootComments()}>
                      Показать ещё комментарии
                    </button>
                  )}
                </div>
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Написать комментарий..."
                  rows={2}
                />
                <div className="feed-comment-box__actions">
                  <Button view="action" size="m" disabled={!commentBody.trim()} onClick={() => void submitComment()}>
                    Отправить
                  </Button>
                </div>
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
      <Card
        view="filled"
        className={[
          'feed-item__card',
          highlighted ? 'feed-item__card--focused' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
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
      <Dialog
        open={reactionDialogOpen}
        onClose={() => setReactionDialogOpen(false)}
        size="m"
        aria-label="Реакции к новости"
      >
        <Dialog.Header caption="Реакции" />
        <Dialog.Body>
          <div className="feed-reaction-roster">
            <div className="feed-reaction-roster__filters">
              <button
                type="button"
                className={`feed-reaction-roster__filter${reactionDialogFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setReactionDialogFilter('all')}
              >
                Все {reactionsTotal}
              </button>
              {reactionSummary
                .filter((row) => row.count > 0)
                .map((row) => (
                  <button
                    key={row.emoji}
                    type="button"
                    className={`feed-reaction-roster__filter${reactionDialogFilter === row.emoji ? ' is-active' : ''}`}
                    onClick={() => setReactionDialogFilter(row.emoji)}
                  >
                    {row.emoji} {row.count}
                  </button>
                ))}
            </div>
            {reactionDetailsLoading ? (
              <div className="feed-reaction-roster__loading">
                <Loader size="m" />
              </div>
            ) : reactionDetailsFiltered.length === 0 ? (
              <Text variant="body-2" color="secondary">
                Пока никто не отреагировал.
              </Text>
            ) : (
              <div className="feed-reaction-roster__list">
                {reactionDetailsFiltered.map((row) => {
                  const rowLabel = getDisplayName(row.user_profile, row.user_id, user);
                  const rowAvatarUrl = row.user_id === user?.id ? user.avatarUrl : row.user_profile?.avatar_url;
                  return (
                    <div key={row.id} className="feed-reaction-roster__item">
                      <div className="feed-reaction-roster__identity">
                        <Avatar
                          size="m"
                          imgUrl={rowAvatarUrl ?? undefined}
                          text={rowLabel}
                          title={rowLabel}
                        />
                        <div className="feed-reaction-roster__identity-meta">
                          <Text variant="body-2">{rowLabel}</Text>
                          <Text variant="caption-2" color="secondary">
                            {formatDateTime(row.created_at)}
                          </Text>
                        </div>
                      </div>
                      <span className="feed-reaction-roster__emoji">{row.emoji}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog.Body>
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
              value={[editStatus]}
              onUpdate={(values) => {
                const next = values[0] as 'published' | 'draft' | undefined;
                if (next) setEditStatus(next);
              }}
              options={[
                { value: 'published', content: 'Опубликовать' },
                { value: 'draft', content: 'Сохранить как черновик' },
              ]}
            />
            <Select
              value={[editVisibility]}
              onUpdate={(values) => {
                const next = values[0] as 'public' | 'private' | 'community' | 'team' | undefined;
                if (next) setEditVisibility(next);
              }}
              options={[
                { value: 'public', content: 'Публично' },
                { value: 'private', content: 'Приватно' },
              ]}
              disabled={editStatus === 'draft'}
            />
            <Text variant="caption-2" color="secondary">
              Заголовок берётся из первой строки вида `# Заголовок`. Теги и YouTube-видео обновляются автоматически.
            </Text>
          </div>
        </Dialog.Body>
        <Dialog.Footer
          textButtonCancel="Отмена"
          textButtonApply={editSaving ? 'Сохранение...' : 'Сохранить'}
          onClickButtonCancel={() => setEditOpen(false)}
          onClickButtonApply={handleEditSave}
          loading={editSaving}
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
          textButtonCancel="Отмена"
          textButtonApply={deleteSaving ? 'Удаление...' : 'Удалить'}
          onClickButtonCancel={() => setDeleteOpen(false)}
          onClickButtonApply={handleDelete}
          loading={deleteSaving}
        />
      </Dialog>
    </>
  );
};
