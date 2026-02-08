import React, {useMemo} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import {Loader, ToasterComponent, ToasterProvider} from '@gravity-ui/uikit';
import {toaster} from '@gravity-ui/uikit/toaster-singleton';

import {useEvent, useSetRsvp, useUpdateEvent, useExportEventAsIcs} from '../hooks';
import {EventRsvpPage} from './EventRsvpPage/EventRsvpPage';

export const EventRsvpRoute: React.FC = () => {
    const {id = ''} = useParams<{id: string}>();
    const navigate = useNavigate();
    const routeBase = useRouteBase();

    const eventQuery = useEvent(id);
    const setRsvpMutation = useSetRsvp(id);
    const updateEventMutation = useUpdateEvent(id);
    const exportIcsMutation = useExportEventAsIcs();

    const shareUrl = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return window.location.href;
    }, []);

    if (eventQuery.isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader size="l" />
            </div>
        );
    }

    if (!eventQuery.data) {
        return (
            <div className="py-10 text-center text-slate-500">
                Событие не найдено
            </div>
        );
    }

    const event = eventQuery.data;

    return (
        <ToasterProvider toaster={toaster}>
            <EventRsvpPage
                event={event}
                myRsvp={event.myRsvp ?? undefined}
                onRsvpChange={(value) => setRsvpMutation.mutate(value)}
                onBack={() => navigate(`${routeBase}/events`)}
                onAddToCalendar={() => exportIcsMutation.mutate(id)}
                // onEdit — оставил как хук для твоей логики (диалог/страница редактирования)
                onEdit={() => navigate(`${routeBase}/events/${id}?edit=1`)}
                onSaveDescription={async (markup) => {
                    await new Promise<void>((resolve, reject) => {
                        updateEventMutation.mutate(
                            {description: markup},
                            {
                                onSuccess: () => resolve(),
                                onError: (e) => reject(e),
                            },
                        );
                    });
                }}
                shareUrl={shareUrl}
                // mediaItems можно будет прокинуть сюда из бэка позже
                mediaItems={[]}
            />
            <ToasterComponent />
        </ToasterProvider>
    );
};
