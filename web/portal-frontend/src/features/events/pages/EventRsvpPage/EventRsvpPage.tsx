import React, {useMemo, useState} from 'react';
import {
  Button,
  Card,
  Dialog,
  Icon,
  Label,
  SegmentedRadioGroup,
  Text,
  Tooltip,
  useToaster,
} from '@gravity-ui/uikit';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Link as LinkIcon,
  MapPin,
  Pencil,
} from '@gravity-ui/icons';

import {
  MarkdownEditorView,
  YfmStaticView,
  useMarkdownEditor,
} from '@gravity-ui/markdown-editor';

import '@diplodoc/transform/dist/css/yfm.css';
import '@diplodoc/transform/dist/js/yfm.js';

import type {EventWithCounts} from '../../types';
import {renderYfmHtml} from '../../utils/yfm';
import {EventRsvpCounts} from '../../components/EventRsvpCounts';

type RsvpValue = 'going' | 'interested' | 'not_going';

type Props = {
  event: EventWithCounts;

  myRsvp?: RsvpValue;
  onRsvpChange?: (value: RsvpValue) => void;

  onBack: () => void;

  // маленькие иконки в медиакарточке
  onEdit?: () => void;
  onAddToCalendar?: () => void;

  // описание (YFM/Markdown строка) — на бэк уходит ТОЛЬКО markup
  onSaveDescription?: (markup: string) => Promise<void> | void;

  // ссылка страницы (для копирования)
  shareUrl: string;
  // заглушка под галерею / медиа; пока не используется
  mediaItems?: unknown[];
};

const VISIBILITY: Record<
  string,
  {theme: 'info' | 'success' | 'warning' | 'danger' | 'normal' | 'utility'; label: string}
> = {
  public: {theme: 'info', label: 'Публичное'},
  community: {theme: 'success', label: 'Сообщество'},
  team: {theme: 'warning', label: 'Команда'},
  private: {theme: 'danger', label: 'Приватное'},
};

async function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRange(startsAt?: string | null, endsAt?: string | null, locale = 'ru-RU') {
  const s = safeDate(startsAt);
  const e = safeDate(endsAt);
  if (!s) return null;

  const date = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', year: 'numeric'}).format(s);
  const st = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'}).format(s);
  const et = e ? new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'}).format(e) : null;

  return et ? `${date} · ${st}–${et}` : `${date} · ${st}`;
}

function formatDuration(startsAt?: string | null, endsAt?: string | null) {
  const s = safeDate(startsAt);
  const e = safeDate(endsAt);
  if (!s || !e) return null;

  const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
  if (mins <= 0) return null;

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  const parts: string[] = [];
  if (h) parts.push(`${h}ч`);
  if (m) parts.push(`${m}м`);
  return parts.join(' ');
}

const IconAction: React.FC<{icon: any; tooltip: string; onClick?: () => void}> = ({icon, tooltip, onClick}) => (
  <Tooltip content={tooltip} placement="bottom">
    <Button
      view="flat"
      size="m"
      className="!p-2 rounded-lg bg-white/70 hover:bg-white/90 backdrop-blur border border-white/50 shadow-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Icon data={icon} />
    </Button>
  </Tooltip>
);

export const EventRsvpPage: React.FC<Props> = ({
  event,
  myRsvp,
  onRsvpChange,
  onBack,
  onEdit,
  onAddToCalendar,
  onSaveDescription,
  shareUrl,
}) => {
  const {add} = useToaster();
  const [descOpen, setDescOpen] = useState(false);

  const visibility = VISIBILITY[event.visibility] ?? {theme: 'normal', label: String(event.visibility ?? '—')};
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'ru-RU';

  const when = useMemo(() => formatRange(event.startsAt, event.endsAt, locale), [event.endsAt, event.startsAt, locale]);
  const duration = useMemo(() => formatDuration(event.startsAt, event.endsAt), [event.endsAt, event.startsAt]);

  const editor = useMarkdownEditor({
    initial: {
      mode: 'markup',
      markup: event.description ?? '',
      toolbarVisible: true,
      splitModeEnabled: true,
    },
    markupConfig: {
      renderPreview: ({getValue}) => (
        <div className="yfm p-3">
          <YfmStaticView html={renderYfmHtml(String(getValue() ?? ''))} />
        </div>
      ),
    },
  });

  const handleCopy = async () => {
    await copyToClipboard(shareUrl);
    add({
      name: `copy-link-${event.id}`,
      title: 'Ссылка скопирована в буфер обмена',
      theme: 'success',
      autoHiding: 2500,
      isClosable: false,
    });
  };

  const handleSaveDescription = async () => {
    const markup = String(editor.getValue() ?? '');
    await onSaveDescription?.(markup); // на бэк уходит ТОЛЬКО markup
    setDescOpen(false);
    add({
      name: `desc-saved-${event.id}`,
      title: 'Описание сохранено',
      theme: 'success',
      autoHiding: 2000,
      isClosable: false,
    });
  };

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 space-y-3">
      {/* Back (над карточкой) */}
      <div>
        <Button view="flat" size="l" onClick={onBack}>
          <Icon data={ArrowLeft} className="mr-2" />
          К голосованиям
        </Button>
      </div>

      <Card view="filled" className="p-5 sm:p-6 rounded-2xl">
        <div className="space-y-4">
          {/* Title + tags */}
          <div className="space-y-2">
            <div className="text-3xl font-semibold leading-tight text-slate-900">
              {event.title}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Label theme={visibility.theme} size="s">{visibility.label}</Label>
              {event.scopeType ? <Label theme="utility" size="s">{event.scopeType}</Label> : null}
              {event.myRsvp ? <Label theme="success" size="s">Мой RSVP: {event.myRsvp}</Label> : null}
            </div>

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              {when ? (
                <div className="flex items-center gap-1.5">
                  <Icon data={Clock} size={16} />
                  <span>{when}</span>
                  {duration ? <span className="text-slate-400">·</span> : null}
                  {duration ? <span className="text-slate-500">{duration}</span> : null}
                </div>
              ) : null}

              {event.locationText ? (
                <div className="flex items-center gap-1.5">
                  <Icon data={MapPin} size={16} />
                  {event.locationUrl ? (
                    <a className="hover:underline" href={event.locationUrl} target="_blank" rel="noreferrer">
                      {event.locationText}
                    </a>
                  ) : (
                    <span>{event.locationText}</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Media 16:9 */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <div className="aspect-video">
              {/* Заглушка под галерею */}
              <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center">
                <Text color="secondary">Галерея 16:9 (заглушка)</Text>
              </div>
            </div>

            {/* Action icons INSIDE media */}
            <div className="absolute right-3 top-3 flex gap-2">
              {onEdit ? <IconAction icon={Pencil} tooltip="Редактировать" onClick={onEdit} /> : null}
              {onAddToCalendar ? <IconAction icon={Calendar} tooltip="В календарь" onClick={onAddToCalendar} /> : null}
              <IconAction icon={LinkIcon} tooltip="Скопировать ссылку" onClick={handleCopy} />
            </div>
          </div>

          {/* Description */}
          <div className="pt-1">
            <div className="flex items-center justify-between gap-3">
              <Text variant="subheader-2">Описание</Text>
              {onSaveDescription ? (
                <Button view="flat" size="m" onClick={() => setDescOpen(true)}>
                  <Icon data={Pencil} className="mr-2" />
                  Изменить
                </Button>
              ) : null}
            </div>

            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
              {event.description?.trim() ? (
                <div className="yfm">
                  <YfmStaticView html={renderYfmHtml(event.description ?? '')} />
                </div>
              ) : (
                <Text color="secondary">Описание пока не добавлено.</Text>
              )}
            </div>
          </div>

          {/* RSVP actions */}
          <div className="pt-2">
            <div className="flex justify-center">
              <SegmentedRadioGroup
                name="rsvp"
                size="l"
                value={myRsvp}
                onUpdate={(v) => onRsvpChange?.(v as RsvpValue)}
              >
                <SegmentedRadioGroup.Option value="going">Иду</SegmentedRadioGroup.Option>
                <SegmentedRadioGroup.Option value="interested">Интересно</SegmentedRadioGroup.Option>
                <SegmentedRadioGroup.Option value="not_going">Не пойду</SegmentedRadioGroup.Option>
              </SegmentedRadioGroup>
            </div>
          </div>

          {/* Counters bottom (centered) */}
          <div className="pt-2">
            <EventRsvpCounts counts={event.rsvpCounts} compact={false} />
          </div>
        </div>
      </Card>

      {/* Description editor dialog */}
      {onSaveDescription ? (
        <Dialog open={descOpen} onClose={() => setDescOpen(false)} size="l" aria-label="Редактор описания">
          <Dialog.Header caption="Редактор описания" />
          <Dialog.Body>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <MarkdownEditorView editor={editor} stickyToolbar />
            </div>
          </Dialog.Body>
          <Dialog.Footer
            textButtonCancel="Отмена"
            textButtonApply="Сохранить"
            onClickButtonCancel={() => setDescOpen(false)}
            onClickButtonApply={handleSaveDescription}
          />
        </Dialog>
      ) : null}
    </div>
  );
};
