import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useMarkdownEditor } from '@gravity-ui/markdown-editor';

import {
  useFeedInfinite,
  useMarkFeedAsRead,
  useUnreadCount,
  useCreateNews,
  useSubscriptions,
  useUpdateSubscriptions,
} from '../../../hooks/useActivity';
import type { NewsMediaItem } from '../../../types/activity';
import { FeedComposerPanel } from '../components/FeedComposerPanel';
import { FeedControlRail } from '../components/FeedControlRail';
import { FeedStreamView } from '../components/FeedStreamView';
import { deleteNews, requestNewsMediaUpload, uploadNewsMediaFile } from '../../../api/activity';
import { createClientAccessDeniedError, toAccessDeniedError } from '../../../api/accessDenied';
import { notifyApiError } from '../../../utils/apiErrorHandling';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { useFeedFilters } from '../hooks/useFeedFilters';
import { TITLE_REGEX, extractTags, extractTitle, extractYoutubeIds, mapYoutubeMediaFromIds } from '../utils/composer';
import './feed-page.css';

export const FeedPage: React.FC = () => {
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

  const typesParam = useMemo(() => {
    if (source === 'news') return ['news.posted', 'post.created'].join(',');
    if (source === 'voting') return ['vote.cast'].join(',');
    if (source === 'events') return ['event.created', 'event.rsvp.changed'].join(',');
    return undefined;
  }, [source]);
  const range = useMemo(() => {
    if (period === 'all') return { from: undefined, to: undefined };
    const now = new Date();
    const base = new Date(now.getTime());
    if (period === 'day') base.setDate(now.getDate() - 1);
    if (period === 'week') base.setDate(now.getDate() - 7);
    if (period === 'month') base.setDate(now.getDate() - 30);
    return { from: base.toISOString(), to: now.toISOString() };
  }, [period]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useFeedInfinite({ types: typesParam, from: range.from, to: range.to, limit: 20 });

  const { count: unreadCount } = useUnreadCount();
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkFeedAsRead();
  const { mutateAsync: createNews, isPending: isCreatingNews } = useCreateNews();
  const { data: subscriptions, isLoading: isSubscriptionsLoading } = useSubscriptions();
  const { mutateAsync: updateSubscriptions, isPending: isUpdatingSubscriptions } = useUpdateSubscriptions();
  const autoSubscribedRef = useRef(false);

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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (!canReadFeed) return;
    if (!tenantId) return;
    if (autoSubscribedRef.current) return;
    if (isSubscriptionsLoading || isUpdatingSubscriptions) return;

    const current = subscriptions?.[0];
    const scopes = current && typeof current.rulesJson === 'object'
      ? (current.rulesJson as { scopes?: { scope_type?: string; scope_id?: string }[] | { scopeType?: string; scopeId?: string }[] }).scopes
      : undefined;
    const hasScopes = Array.isArray(scopes) && scopes.length > 0;

    if (hasScopes) {
      autoSubscribedRef.current = true;
      return;
    }

    autoSubscribedRef.current = true;
    updateSubscriptions({ scopes: [{ scopeType: 'tenant', scopeId: tenantId }] }).catch((err) => {
      autoSubscribedRef.current = false;
      notifyApiError(err, 'Не удалось настроить подписку на ленту');
    });
  }, [isSubscriptionsLoading, isUpdatingSubscriptions, subscriptions, tenantId, updateSubscriptions]);

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
        scopeType: 'tenant',
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
  const getItemNewsId = useCallback(
    (item: { payloadJson?: Record<string, unknown> }) => {
      const maybe = (item.payloadJson ?? {}).news_id;
      return typeof maybe === 'string' ? maybe : null;
    },
    [],
  );

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

  if (!canReadFeed) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: 'activity.feed.read',
          tenant: user?.tenant,
        })}
      />
    );
  }

  if (error) {
    const deniedError = toAccessDeniedError(error, { source: 'api', tenant: user?.tenant });
    if (deniedError) {
      return <AccessDeniedScreen error={deniedError} />;
    }

    return (
      <div className="feed-page" data-qa="feed-page">
        <Card view="filled" className="feed-empty" data-qa="feed-error">
          <Text variant="subheader-2">
            Не удалось загрузить ленту.
          </Text>
          <Text variant="body-2" color="secondary">
            Попробуйте обновить страницу.
          </Text>
          <Button view="flat" size="m" onClick={() => refetch()}>
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="feed-page" data-qa="feed-page">
      <div className="feed-page__layout">
        <section className="feed-stream">
          <FeedStreamView
            unreadCount={unreadCount}
            refetch={refetch}
            isMarkingRead={isMarkingRead}
            markAsRead={() => markAsRead()}
            canModerateNews={canModerateNews}
            moderationMode={moderationMode}
            toggleModerationMode={toggleModerationMode}
            selectedModerationCount={selectedModerationIds.length}
            moderationReason={moderationReason}
            setModerationReason={setModerationReason}
            moderationError={moderationError}
            clearModerationSelection={() => setSelectedModerationIds([])}
            handleModerationDeleteSelected={handleModerationDeleteSelected}
            hasContent={hasContent}
            isLoading={isLoading}
            source={source}
            sortedItems={sortedItems}
            selectedModerationIds={selectedModerationIds}
            getItemNewsId={getItemNewsId}
            handleModerationToggle={handleModerationToggle}
            loadMoreRef={loadMoreRef}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={Boolean(hasNextPage)}
          />
          <FeedComposerPanel
            canCreateNews={canCreateNews}
            composerOpen={composerOpen}
            setComposerOpen={setComposerOpen}
            emptyToolbarsPreset={emptyToolbarsPreset}
            editor={editor}
            fileInputRef={fileInputRef}
            handleImageUpload={handleImageUpload}
            detectedTags={detectedTags}
            composerError={composerError}
            newsVisibility={newsVisibility}
            setNewsVisibility={setNewsVisibility}
            isCreatingNews={isCreatingNews}
            uploading={uploading}
            composerHasText={composerHasText}
            composerHasMedia={composerHasMedia}
            handlePublishNews={handlePublishNews}
            newsMedia={newsMedia}
            handleRemoveMedia={handleRemoveMedia}
          />
        </section>
        <FeedControlRail
          source={source}
          sort={sort}
          period={period}
          setSort={(value) => setSort(value)}
          setSource={(value) => setSource(value)}
          setPeriod={(value) => setPeriod(value)}
          resetFilters={resetFilters}
          realtimeFlagEnabled={realtimeFlagEnabled}
        />
      </div>
    </div>
  );
};
