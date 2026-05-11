import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import {
  activityKeys,
  useCreateNews,
  useDraftNews,
  useFeedInfinite,
  useMarkFeedAsRead,
  useNews,
  useSubscriptions,
  useUnreadCount,
  useUpdateSubscriptions,
} from '../../../hooks/useActivity';
import type { ActivityEvent, NewsMediaItem } from '../../../types/activity';
import { buildFeedLiveUrl, deleteNews, fetchNews, requestNewsMediaUpload, uploadNewsMediaFile } from '../../../api/activity';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { useFeedFilters } from './useFeedFilters';
import { removeDraftItem, removeFeedNews, upsertDraftItem, upsertFeedItem } from '../cache';
import { TITLE_REGEX, extractTags, extractTitle, extractYoutubeIds, mapYoutubeMediaFromIds } from '../utils/composer';

const getFeedTypes = (source: 'all' | 'news' | 'voting' | 'events') => {
  if (source === 'news') return ['news.posted', 'post.created'].join(',');
  if (source === 'voting') return ['vote.cast'].join(',');
  if (source === 'events') return ['event.created', 'event.rsvp.changed'].join(',');
  return undefined;
};

const getPeriodRange = (period: 'day' | 'week' | 'month' | 'all') => {
  if (period === 'all') return { from: undefined, to: undefined };
  const now = new Date();
  const base = new Date(now.getTime());
  if (period === 'day') base.setDate(now.getDate() - 1);
  if (period === 'week') base.setDate(now.getDate() - 7);
  if (period === 'month') base.setDate(now.getDate() - 30);
  return { from: base.toISOString(), to: now.toISOString() };
};

const buildOptimisticNewsId = () => `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildOptimisticNewsEvent = ({
  tenantId,
  user,
  newsId,
  title,
  body,
  tags,
  media,
  visibility,
  status,
}: {
  tenantId: string;
  user: { id: string; username?: string; displayName?: string; avatarUrl?: string | null } | null;
  newsId: string;
  title?: string;
  body: string;
  tags: string[];
  media: NewsMediaItem[];
  visibility: 'public' | 'private';
  status: 'published' | 'draft';
}): ActivityEvent => {
  const occurredAt = new Date().toISOString();
  return {
    id: -Date.now(),
    tenantId,
    actorUserId: user?.id ?? null,
    targetUserId: null,
    type: 'news.posted',
    occurredAt,
    title: title || body.slice(0, 120).trim() || 'Новость',
    payloadJson: {
      news_id: newsId,
      title: title ?? null,
      body,
      tags,
      media,
      status,
      comments_count: 0,
      reactions_count: 0,
      views_count: 0,
      reaction_counts: [],
      my_reactions: [],
      permalink: {
        news_id: newsId,
        path: `/feed/${newsId}`,
      },
      optimistic: true,
    },
    visibility,
    scopeType: 'TENANT',
    scopeId: tenantId,
    sourceRef: `news:${newsId}`,
    actorProfile: user
      ? {
          user_id: user.id,
          username: user.username ?? null,
          display_name: user.displayName ?? null,
          avatar_url: user.avatarUrl ?? null,
        }
      : null,
  };
};

export function useFeedPageController() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { newsId: focusedNewsId } = useParams<{ newsId?: string }>();
  const tenantId = user?.tenant?.id ?? null;
  const canReadFeed = can(user, 'activity.feed.read');
  const canCreateNews = can(user, 'activity.news.create');
  const canModerateNews = can(user, 'activity.news.manage');
  const realtimeFlagEnabled = user?.featureFlags?.activity_feed_realtime_enabled === true;
  const { source, period, sort, setSource, setPeriod, setSort, resetFilters } = useFeedFilters();

  const [newsMedia, setNewsMedia] = useState<NewsMediaItem[]>([]);
  const [publishMode, setPublishMode] = useState<'public' | 'private' | 'draft'>('public');
  const [uploading, setUploading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [moderationMode, setModerationMode] = useState(false);
  const [selectedModerationIds, setSelectedModerationIds] = useState<string[]>([]);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [liveFallback, setLiveFallback] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSubscribedRef = useRef(false);
  const liveEventSourceRef = useRef<EventSource | null>(null);
  const isPermalinkView = Boolean(focusedNewsId);

  const typesParam = useMemo(() => getFeedTypes(source), [source]);
  const range = useMemo(() => getPeriodRange(period), [period]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useFeedInfinite(
    {
      types: typesParam,
      from: range.from,
      to: range.to,
      limit: 20,
    },
    { enabled: canReadFeed && !isPermalinkView },
  );
  const {
    data: focusedNews,
    error: focusedNewsError,
    isLoading: isFocusedNewsLoading,
    refetch: refetchFocusedNews,
  } = useNews(focusedNewsId ?? null);
  const { data: draftItems = [] } = useDraftNews(12, { enabled: canCreateNews && !isPermalinkView });
  const { count: unreadCount } = useUnreadCount();
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkFeedAsRead();
  const { mutateAsync: createNews, isPending: isCreatingNews } = useCreateNews();
  const { data: subscriptions, isLoading: isSubscriptionsLoading } = useSubscriptions();
  const { mutateAsync: updateSubscriptions, isPending: isUpdatingSubscriptions } = useUpdateSubscriptions();

  const items = useMemo(() => {
    const base = data?.pages.flatMap((page) => page.items) ?? [];
    if (!focusedNews) return base;
    const focusedId = typeof focusedNews.payloadJson?.news_id === 'string' ? focusedNews.payloadJson.news_id : null;
    const rest = base.filter((item) => {
      const itemId = typeof item.payloadJson?.news_id === 'string' ? item.payloadJson.news_id : null;
      return focusedId ? itemId !== focusedId : item.id !== focusedNews.id;
    });
    return [focusedNews, ...rest];
  }, [data?.pages, focusedNews]);
  const sortedItems = useMemo(() => {
    const base = [...items];
    const pinned = focusedNews ? base.shift() ?? null : null;
    if (sort === 'best') {
      const sorted = base.sort((a, b) => {
        const aPayload = (a.payloadJson ?? {}) as { reactions_count?: number; comments_count?: number };
        const bPayload = (b.payloadJson ?? {}) as { reactions_count?: number; comments_count?: number };
        const aScore = (aPayload.reactions_count ?? 0) + (aPayload.comments_count ?? 0);
        const bScore = (bPayload.reactions_count ?? 0) + (bPayload.comments_count ?? 0);
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });
      return pinned ? [pinned, ...sorted] : sorted;
    }
    return pinned ? [pinned, ...base] : base;
  }, [focusedNews, items, sort]);

  useEffect(() => {
    if (!canReadFeed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [canReadFeed, fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (
      isPermalinkView ||
      !canReadFeed ||
      !tenantId ||
      autoSubscribedRef.current ||
      isSubscriptionsLoading ||
      isUpdatingSubscriptions
    ) {
      return;
    }
    const current = subscriptions?.[0];
    const scopes =
      current && typeof current.rulesJson === 'object'
        ? (
            current.rulesJson as
              | { scopes?: { scope_type?: string; scope_id?: string }[] }
              | { scopes?: { scopeType?: string; scopeId?: string }[] }
          ).scopes
        : undefined;
    if (Array.isArray(scopes) && scopes.length > 0) {
      autoSubscribedRef.current = true;
      return;
    }
    autoSubscribedRef.current = true;
    updateSubscriptions({ scopes: [{ scopeType: 'tenant', scopeId: tenantId }] }).catch((err) => {
      autoSubscribedRef.current = false;
      notifyApiError(err, 'Не удалось настроить подписку на ленту');
    });
  }, [canReadFeed, isPermalinkView, isSubscriptionsLoading, isUpdatingSubscriptions, subscriptions, tenantId, updateSubscriptions]);

  useEffect(() => {
    if (!canCreateNews) return;
    if (composerValue.trim() || newsMedia.length > 0) {
      setComposerOpen(true);
    }
  }, [canCreateNews, composerValue, newsMedia.length]);

  const handleRemoveMedia = useCallback((index: number) => {
    setNewsMedia((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const uploads = Array.from(files).slice(0, 6 - newsMedia.length);
        for (const file of uploads) {
          const upload = await requestNewsMediaUpload({
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          });
          await uploadNewsMediaFile(upload.upload_url, upload.upload_headers, file);

          const image = new Image();
          const objectUrl = URL.createObjectURL(file);
          await new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = objectUrl;
          });

          setNewsMedia((prev) => [
            ...prev,
            {
              type: 'image',
              key: upload.key,
              content_type: file.type,
              size_bytes: file.size,
              width: image.naturalWidth || undefined,
              height: image.naturalHeight || undefined,
              url: objectUrl,
            },
          ]);
        }
      } catch (err) {
        notifyApiError(err, 'Не удалось загрузить изображение');
      } finally {
        setUploading(false);
      }
    },
    [newsMedia.length],
  );

  const handlePublishNews = useCallback(async () => {
    const markup = composerValue.trim();
    if (!markup) return;
    const title = extractTitle(markup);
    const tags = extractTags(markup);
    const youtubeIds = extractYoutubeIds(markup);
    const strippedBody = title ? markup.replace(TITLE_REGEX, '').trim() : markup;
    const body = strippedBody || markup;
    const youtubeMedia = mapYoutubeMediaFromIds(youtubeIds);
    const mergedMedia = [...newsMedia, ...youtubeMedia].slice(0, 8);
    const status = publishMode === 'draft' ? 'draft' : 'published';
    const visibility = publishMode === 'private' ? 'private' : 'public';
    const optimisticNewsId = buildOptimisticNewsId();
    const optimisticItem = tenantId
      ? buildOptimisticNewsEvent({
          tenantId,
          user,
          newsId: optimisticNewsId,
          title: title || undefined,
          body,
          tags,
          media: mergedMedia,
          visibility,
          status,
        })
      : null;
    const previousComposerValue = composerValue;
    const previousMedia = newsMedia;
    const previousPublishMode = publishMode;

    if (optimisticItem) {
      if (status === 'draft') {
        upsertDraftItem(queryClient, optimisticItem);
      } else {
        upsertFeedItem(queryClient, optimisticItem, { prependIfMissing: true });
      }
    }

    setComposerValue('');
    setNewsMedia([]);
    setComposerOpen(false);
    setPublishMode('public');

    try {
      const created = await createNews({
        title: title || undefined,
        body,
        tags,
        visibility,
        status,
        scopeType: 'TENANT',
        scopeId: null,
        media: mergedMedia.map((item) => {
          if (item.type === 'image') {
            return {
              type: 'image',
              key: item.key,
              content_type: item.content_type,
              size_bytes: item.size_bytes,
              width: item.width,
              height: item.height,
              caption: item.caption,
            };
          }
          return {
            type: 'youtube',
            url: item.url,
            video_id: item.video_id,
            title: item.title,
          };
        }),
      });
      if (status === 'draft') {
        removeDraftItem(queryClient, optimisticNewsId);
      } else {
        removeFeedNews(queryClient, optimisticNewsId);
      }
      const createdStatus = created.payloadJson?.status;
      const newsId = typeof created.payloadJson?.news_id === 'string' ? created.payloadJson.news_id : null;
      if (createdStatus === 'draft') {
        upsertDraftItem(queryClient, created);
      } else {
        upsertFeedItem(queryClient, created, { prependIfMissing: true });
        if (newsId) {
          removeDraftItem(queryClient, newsId);
        }
        queryClient.setQueryData(activityKeys.unreadCount(), 0);
      }
    } catch (err) {
      if (status === 'draft') {
        removeDraftItem(queryClient, optimisticNewsId);
      } else {
        removeFeedNews(queryClient, optimisticNewsId);
      }
      setComposerValue(previousComposerValue);
      setNewsMedia(previousMedia);
      setComposerOpen(Boolean(previousComposerValue.trim()) || previousMedia.length > 0);
      setPublishMode(previousPublishMode);
      notifyApiError(err, publishMode === 'draft' ? 'Не удалось сохранить черновик' : 'Не удалось опубликовать новость');
    }
  }, [composerValue, createNews, newsMedia, publishMode, queryClient, tenantId, user]);

  const hasContent = sortedItems.length > 0;
  const detectedTags = useMemo(() => extractTags(composerValue), [composerValue]);
  const composerHasText = Boolean(composerValue.trim());
  const canPublishNews = composerHasText && !isCreatingNews && !uploading;

  const getItemNewsId = useCallback((item: ActivityEvent) => {
    const maybe = (item.payloadJson ?? {}).news_id;
    return typeof maybe === 'string' ? maybe : null;
  }, []);

  const handleModerationToggle = useCallback((newsId: string, selected: boolean) => {
    setSelectedModerationIds((prev) => {
      if (selected) {
        if (prev.includes(newsId)) return prev;
        return [...prev, newsId].slice(0, 20);
      }
      return prev.filter((id) => id !== newsId);
    });
  }, []);

  const handleModerationDeleteSelected = useCallback(async () => {
    if (!moderationMode) return;
    if (!moderationReason.trim()) {
      setModerationError('Укажите причину модераторского действия');
      return;
    }
    if (selectedModerationIds.length === 0) {
      setModerationError('Выберите хотя бы одну новость');
      return;
    }
    setModerationError(null);
    try {
      await Promise.all(selectedModerationIds.map((id) => deleteNews(id)));
      setSelectedModerationIds([]);
      setModerationReason('');
      refetch();
    } catch (err) {
      notifyApiError(err, 'Не удалось выполнить массовое модераторское действие');
    }
  }, [moderationMode, moderationReason, refetch, selectedModerationIds]);

  const toggleModerationMode = useCallback(() => {
    setModerationMode((prev) => !prev);
    setSelectedModerationIds([]);
    setModerationReason('');
    setModerationError(null);
  }, []);

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (canPublishNews) {
          void handlePublishNews();
        }
      }
    },
    [canPublishNews, handlePublishNews],
  );

  useEffect(() => {
    if (!canReadFeed) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setLiveFallback(true);
      return;
    }

    const source = new EventSource(buildFeedLiveUrl(), { withCredentials: true });
    liveEventSourceRef.current = source;
    setLiveFallback(false);

    const handleUpsert = async (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { news_id?: string };
        if (!payload.news_id) return;
        const item = await fetchNews(payload.news_id);
        if (item.payloadJson?.status === 'draft') {
          upsertDraftItem(queryClient, item);
          removeFeedNews(queryClient, payload.news_id);
        } else {
          upsertFeedItem(queryClient, item, { prependIfMissing: true });
          removeDraftItem(queryClient, payload.news_id);
        }
        if (item.actorUserId && item.actorUserId === user?.id) {
          queryClient.setQueryData(activityKeys.unreadCount(), 0);
        }
        window.dispatchEvent(new CustomEvent('activity:news-upsert', { detail: { newsId: payload.news_id } }));
      } catch (err) {
        notifyApiError(err, 'Не удалось обновить карточку новости');
      }
    };

    const handleDelete = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { news_id?: string };
      if (!payload.news_id) return;
      removeFeedNews(queryClient, payload.news_id);
      removeDraftItem(queryClient, payload.news_id);
      window.dispatchEvent(new CustomEvent('activity:news-delete', { detail: { newsId: payload.news_id } }));
    };

    source.addEventListener('news-upsert', handleUpsert as unknown as EventListener);
    source.addEventListener('news-delete', handleDelete as unknown as EventListener);
    source.addEventListener('close', () => {
      source.close();
      setLiveFallback(true);
    });
    source.onerror = () => {
      setLiveFallback(true);
    };

    return () => {
      source.removeEventListener('news-upsert', handleUpsert as unknown as EventListener);
      source.removeEventListener('news-delete', handleDelete as unknown as EventListener);
      source.close();
      liveEventSourceRef.current = null;
    };
  }, [canReadFeed, queryClient, user?.id]);

  useEffect(() => {
    if (!canReadFeed || !liveFallback) return;
    const timer = window.setInterval(() => {
      refetch();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [canReadFeed, liveFallback, refetch]);

  useEffect(() => {
    if (!canModerateNews) return;

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tagName === 'input' || tagName === 'textarea' || target?.isContentEditable === true;
      if (isTypingTarget) return;

      if (event.altKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        toggleModerationMode();
        return;
      }

      if (event.key === 'Escape' && moderationMode) {
        event.preventDefault();
        setModerationMode(false);
        setSelectedModerationIds([]);
        setModerationReason('');
        setModerationError(null);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [canModerateNews, moderationMode, toggleModerationMode]);

  return {
    user,
    canReadFeed,
    canCreateNews,
    canModerateNews,
    isPermalinkView,
    realtimeFlagEnabled,
    source,
    period,
    sort,
    setSource,
    setPeriod,
    setSort,
    resetFilters,
    error: isPermalinkView ? focusedNewsError ?? null : error,
    refetch: isPermalinkView ? refetchFocusedNews : refetch,
    unreadCount,
    isMarkingRead,
    markAsRead,
    moderationMode,
    toggleModerationMode,
    selectedModerationIds,
    moderationReason,
    setModerationReason,
    moderationError,
    setSelectedModerationIds,
    handleModerationDeleteSelected,
    hasContent,
    isLoading: isPermalinkView ? isFocusedNewsLoading : isLoading,
    sortedItems,
    draftItems,
    focusedNewsId,
    focusedNews,
    getItemNewsId,
    handleModerationToggle,
    loadMoreRef,
    isFetchingNextPage,
    hasNextPage: Boolean(hasNextPage),
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
  } as const;
}
