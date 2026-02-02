import React, {useMemo, useState} from 'react';
import {Button, Icon, Text} from '@gravity-ui/uikit';
import {ChevronLeft, ChevronRight} from '@gravity-ui/icons';

export type EventMediaItem = {
    id: string;
    src: string;
    alt?: string;
};

type Props = {
    items?: EventMediaItem[];
    className?: string;

    // слот под правый верхний угол (иконки действий)
    topRightSlot?: React.ReactNode;
};

export const EventMediaGallery: React.FC<Props> = ({items = [], className, topRightSlot}) => {
    const hasItems = items.length > 0;
    const [active, setActive] = useState(0);

    const activeItem = useMemo(() => (hasItems ? items[Math.min(active, items.length - 1)] : null), [active, hasItems, items]);

    const canPrev = hasItems && active > 0;
    const canNext = hasItems && active < items.length - 1;

    const goPrev = () => setActive((p) => Math.max(0, p - 1));
    const goNext = () => setActive((p) => Math.min(items.length - 1, p + 1));

    return (
        <div className={['relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100', className].filter(Boolean).join(' ')}>
            <div className="aspect-video">
                {hasItems && activeItem ? (
                    <img
                        src={activeItem.src}
                        alt={activeItem.alt ?? 'Event media'}
                        className="h-full w-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center">
                        <Text color="secondary">Галерея 16:9 (заглушка)</Text>
                    </div>
                )}
            </div>

            {/* Top-right actions (edit/calendar/copy) */}
            {topRightSlot ? (
                <div className="absolute right-3 top-3 flex gap-2">
                    {topRightSlot}
                </div>
            ) : null}

            {/* Left/Right controls */}
            {hasItems && items.length > 1 ? (
                <>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Button view="flat" size="m" disabled={!canPrev} className="!p-2 rounded-lg bg-white/70 hover:bg-white/90 backdrop-blur border border-white/50 shadow-sm" onClick={goPrev}>
                            <Icon data={ChevronLeft} />
                        </Button>
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Button view="flat" size="m" disabled={!canNext} className="!p-2 rounded-lg bg-white/70 hover:bg-white/90 backdrop-blur border border-white/50 shadow-sm" onClick={goNext}>
                            <Icon data={ChevronRight} />
                        </Button>
                    </div>

                    {/* Thumbs */}
                    <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex gap-2 overflow-x-auto">
                            {items.map((it, idx) => (
                                <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => setActive(idx)}
                                    className={[
                                        'h-10 w-16 flex-shrink-0 overflow-hidden rounded-lg border',
                                        idx === active ? 'border-indigo-500' : 'border-white/50',
                                    ].join(' ')}
                                >
                                    <img src={it.src} alt={it.alt ?? 'thumb'} className="h-full w-full object-cover" draggable={false} />
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};
