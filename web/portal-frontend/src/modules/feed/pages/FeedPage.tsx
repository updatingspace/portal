import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Icon, Label, Loader, Select, Text } from '@gravity-ui/uikit';
import { Plus, ArrowRotateRight } from '@gravity-ui/icons';
import { MarkdownEditorView, useMarkdownEditor } from '@gravity-ui/markdown-editor';

import {
  useFeedInfinite,
  useMarkFeedAsRead,
  useUnreadCount,
  useCreateNews,
  useSubscriptions,
  useUpdateSubscriptions,
} from '../../../hooks/useActivity';
import type { NewsMediaItem } from '../../../types/activity';
import { SkeletonBlock } from '../../../shared/ui/skeleton/SkeletonBlock';
import { FeedFilters } from '../components/FeedFilters';
import { FeedItem } from '../components/FeedItem';
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
          <div className="feed-stream__header">
            <div className="feed-stream__title">
              <Text variant="header-1">Лента активности</Text>
              <Text variant="body-2" color="secondary" className="feed-stream__subtitle">
                Новости сообщества, голосования и игровые события в одном месте.
              </Text>
            </div>
            <div className="feed-stream__header-actions" data-qa="feed-actions">
              <Button view="flat" size="m" onClick={() => refetch()}>
                <Icon data={ArrowRotateRight} />
                Обновить
              </Button>
              {unreadCount > 0 && (
                <Button view="action" size="m" loading={isMarkingRead} onClick={() => markAsRead()}>
                  Отметить прочитанным
                </Button>
              )}
              {canModerateNews && (
                <Button
                  view={moderationMode ? 'outlined-danger' : 'outlined'}
                  size="m"
                  onClick={() => {
                    setModerationMode((prev) => !prev);
                    setSelectedModerationIds([]);
                    setModerationReason('');
                    setModerationError(null);
                  }}
                >
                  {moderationMode ? 'Выйти из модерации' : 'Режим модерации'}
                </Button>
              )}
            </div>
          </div>

          {moderationMode && (
            <Card view="filled" className="feed-moderation-panel">
              <Text variant="subheader-2">Панель модерации</Text>
              <Text variant="body-2" color="secondary">
                Выбрано: {selectedModerationIds.length} (максимум 20)
              </Text>
              <textarea
                className="feed-moderation-panel__reason"
                value={moderationReason}
                onChange={(event) => setModerationReason(event.target.value)}
                placeholder="Укажите причину модераторского действия (для аудита)"
                rows={2}
              />
              {moderationError && (
                <Text variant="caption-2" color="danger">
                  {moderationError}
                </Text>
              )}
              <div className="feed-moderation-panel__actions">
                <Button view="outlined" size="m" onClick={() => setSelectedModerationIds([])}>
                  Очистить выбор
                </Button>
                <Button view="flat-danger" size="m" onClick={handleModerationDeleteSelected}>
                  Удалить выбранные
                </Button>
              </div>
            </Card>
          )}

          {unreadCount > 0 && (
            <Card view="filled" className="feed-unread-banner" data-qa="feed-unread-banner">
              <Text variant="subheader-2">ОГО, новых новостей: {unreadCount}</Text>
              <Text variant="body-2" color="secondary">
                Вы ещё не прочитали их. Пролистайте ленту ниже.
              </Text>
            </Card>
          )}

          {canCreateNews ? (
            <Card
              view="filled"
              className={[
                'feed-composer',
                composerOpen ? 'feed-composer--expanded' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-qa="feed-composer"
            >
              <div className="feed-composer__header">
                <Text variant="subheader-2">Что происходит?</Text>
              </div>

              <div
                className="feed-composer__editor"
                onClick={() => setComposerOpen(true)}
              >
                <MarkdownEditorView
                  editor={editor}
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
                  >
                    Опубликовать
                  </Button>
                </div>
              </div>

              {newsMedia.length > 0 && (
                <div className="feed-composer__media">
                  {newsMedia.map((media, index) => (
                    <div key={`${media.type}-${index}`} className="feed-composer__media-item">
                      {media.type === 'image' && media.url ? (
                        <img src={media.url} alt="preview" />
                      ) : null}
                      <Button view="flat" size="xs" onClick={() => handleRemoveMedia(index)}>
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card view="filled" className="feed-empty" data-qa="feed-composer-locked">
              <Text variant="subheader-2">Публикация новостей недоступна.</Text>
              <Text variant="body-2" color="secondary">
                Для создания новостей требуется дополнительный доступ.
              </Text>
            </Card>
          )}

          {!hasContent && isLoading ? (
            <div className="feed-stream__list" data-qa="feed-list-loading">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={`skeleton-${index}`} view="filled" className="feed-skeleton">
                  <div className="feed-skeleton__row">
                    <SkeletonBlock height={32} width="32px" />
                    <div className="feed-skeleton__content">
                      <SkeletonBlock height={12} width="40%" />
                      <SkeletonBlock height={18} width="70%" />
                      <SkeletonBlock height={12} width="60%" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : !hasContent ? (
            <Card view="filled" className="feed-empty" data-qa="feed-empty">
              <Text variant="subheader-2">
                {source !== 'all' ? 'Нет событий под выбранные фильтры.' : 'Пока нет новых событий.'}
              </Text>
              <Text variant="body-2" color="secondary">
                Добавьте интеграции или вернитесь позже.
              </Text>
            </Card>
          ) : (
            <div className="feed-stream__list" data-qa="feed-list">
              {sortedItems.map((item) => {
                const itemNewsId = getItemNewsId(item);
                return (
                  <FeedItem
                    key={item.id}
                    item={item}
                    showPayload={false}
                    moderationMode={moderationMode}
                    moderationSelected={Boolean(itemNewsId && selectedModerationIds.includes(itemNewsId))}
                    onModerationToggle={handleModerationToggle}
                  />
                );
              })}
            </div>
          )}

          <div ref={loadMoreRef} className="feed-stream__footer" data-qa="feed-footer">
            {isFetchingNextPage && <Loader size="m" />}
            {!hasNextPage && hasContent && (
              <Text variant="caption-2" color="secondary">
                Больше событий нет
              </Text>
            )}
          </div>
        </section>

        <aside className="feed-sidebar" data-qa="feed-sidebar">
          <Card view="filled" className="feed-panel">
            <div className="feed-panel__header">
              <Text variant="subheader-2">Фильтры</Text>
              {source !== 'all' && (
                <Label size="xs" theme="info">
                  1
                </Label>
              )}
            </div>
            <FeedFilters
              sortValue={sort}
              onSortChange={(value) => setSort(value as 'best' | 'recent')}
              sourceValue={source}
              onSourceChange={(value) => setSource(value as 'all' | 'news' | 'voting' | 'events')}
              timeValue={period}
              onTimeChange={(value) => setPeriod(value as 'day' | 'week' | 'month' | 'all')}
              onReset={resetFilters}
              qa="feed-filters"
            />
            <Text variant="caption-2" color="secondary">
              Realtime: {realtimeFlagEnabled ? 'включен флагом' : 'выключен (безопасный режим)'}
            </Text>
          </Card>
        </aside>
      </div>
    </div>
  );
};
