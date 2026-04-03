import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useMarkdownEditor } from '@gravity-ui/markdown-editor';

import {
  useCreateNews,
  useFeedInfinite,
  useMarkFeedAsRead,
  useSubscriptions,
  useUnreadCount,
  useUpdateSubscriptions,
} from '../../../hooks/useActivity';
import type { ActivityEvent, NewsMediaItem } from '../../../types/activity';
import { deleteNews, requestNewsMediaUpload, uploadNewsMediaFile } from '../../../api/activity';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { useFeedFilters } from './useFeedFilters';
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

export function useFeedPageController() {
  const { user } = useAuth();
  const tenantId = user?.tenant?.id ?? null;
  const canReadFeed = can(user, 'activity.feed.read');
  const canCreateNews = can(user, 'activity.news.create');
  const canModerateNews = can(user, 'activity.news.manage');
  const realtimeFlagEnabled = user?.featureFlags?.activity_feed_realtime_enabled === true;
  const { source, period, sort, setSource, setPeriod, setSort, resetFilters } = useFeedFilters();

  const [newsMedia, setNewsMedia] = useState<NewsMediaItem[]>([]);
  const [newsVisibility, setNewsVisibility] = useState<'public' | 'private'>('public');
  const [uploading, setUploading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [moderationMode, setModerationMode] = useState(false);
  const [selectedModerationIds, setSelectedModerationIds] = useState<string[]>([]);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationError, setModerationError] = useState<string | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSubscribedRef = useRef(false);

  const editor = useMarkdownEditor({
    initial: {
      mode: 'markup',
      markup: '',
      toolbarVisible: false,
      splitModeEnabled: false,
    },
  });
  const emptyToolbarsPreset = useMemo(() => ({ items: {}, orders: {} }), []);

  useEffect(() => {
    const handleChange = () => {
      setComposerValue(String(editor.getValue() ?? ''));
    };
    handleChange();
    editor.on('change', handleChange);
    return () => editor.off('change', handleChange);
  }, [editor]);

  const typesParam = useMemo(() => getFeedTypes(source), [source]);
  const range = useMemo(() => getPeriodRange(period), [period]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useFeedInfinite({
    types: typesParam,
    from: range.from,
    to: range.to,
    limit: 20,
  });
  const { count: unreadCount } = useUnreadCount();
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkFeedAsRead();
  const { mutateAsync: createNews, isPending: isCreatingNews } = useCreateNews();
  const { data: subscriptions, isLoading: isSubscriptionsLoading } = useSubscriptions();
  const { mutateAsync: updateSubscriptions, isPending: isUpdatingSubscriptions } = useUpdateSubscriptions();

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const sortedItems = useMemo(() => {
    const base = [...items];
    if (sort === 'best') {
      return base.sort((a, b) => {
        const aPayload = (a.payloadJson ?? {}) as { reactions_count?: number; comments_count?: number };
        const bPayload = (b.payloadJson ?? {}) as { reactions_count?: number; comments_count?: number };
        const aScore = (aPayload.reactions_count ?? 0) + (aPayload.comments_count ?? 0);
        const bScore = (bPayload.reactions_count ?? 0) + (bPayload.comments_count ?? 0);
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });
    }
    return base;
  }, [items, sort]);

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
    if (!canReadFeed || !tenantId || autoSubscribedRef.current || isSubscriptionsLoading || isUpdatingSubscriptions) {
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
  }, [canReadFeed, isSubscriptionsLoading, isUpdatingSubscriptions, subscriptions, tenantId, updateSubscriptions]);

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
    const markup = String(editor.getValue() ?? '').trim();
    if (!markup) return;
    const title = extractTitle(markup);
    const tags = extractTags(markup);
    const youtubeIds = extractYoutubeIds(markup);
    const strippedBody = title ? markup.replace(TITLE_REGEX, '').trim() : markup;
    const body = strippedBody || markup;
    const youtubeMedia = mapYoutubeMediaFromIds(youtubeIds);
    const mergedMedia = [...newsMedia, ...youtubeMedia].slice(0, 8);
    if (mergedMedia.length === 0) {
      setComposerError('Добавьте хотя бы одно изображение или ссылку на YouTube.');
      return;
    }
    try {
      await createNews({
        title: title || undefined,
        body,
        tags,
        visibility: newsVisibility,
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
      if ((editor as unknown as { setValue?: (value: string) => void }).setValue) {
        (editor as unknown as { setValue: (value: string) => void }).setValue('');
      }
      setNewsMedia([]);
      setComposerOpen(false);
      setComposerError(null);
      refetch();
    } catch (err) {
      notifyApiError(err, 'Не удалось опубликовать новость');
    }
  }, [createNews, editor, newsMedia, newsVisibility, refetch]);

  const hasContent = sortedItems.length > 0;
  const detectedYoutube = useMemo(() => extractYoutubeIds(composerValue), [composerValue]);
  const detectedTags = useMemo(() => extractTags(composerValue), [composerValue]);
  const composerHasText = Boolean(composerValue.trim());
  const composerHasMedia = newsMedia.length > 0 || detectedYoutube.length > 0;

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
    (event: ReactKeyboardEvent<'div'>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!isCreatingNews && !uploading && composerHasText && composerHasMedia) {
          void handlePublishNews();
        }
      }
    },
    [composerHasMedia, composerHasText, handlePublishNews, isCreatingNews, uploading],
  );

  useEffect(() => {
    if (composerError && composerHasMedia) {
      setComposerError(null);
    }
  }, [composerError, composerHasMedia]);

  useEffect(() => {
    if (!realtimeFlagEnabled) return;
    const timer = window.setInterval(() => {
      refetch();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [realtimeFlagEnabled, refetch]);

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
    realtimeFlagEnabled,
    source,
    period,
    sort,
    setSource,
    setPeriod,
    setSort,
    resetFilters,
    error,
    refetch,
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
    isLoading,
    sortedItems,
    getItemNewsId,
    handleModerationToggle,
    loadMoreRef,
    isFetchingNextPage,
    hasNextPage: Boolean(hasNextPage),
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
  } as const;
}
