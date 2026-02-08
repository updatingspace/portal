import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, Card } from '@gravity-ui/uikit';
import { useEvent } from '../../../features/events';
import { EventForm } from '../../../features/events/components';
import type { EventWithCounts } from '../../../features/events';
import { useRouteBase } from '@/shared/hooks/useRouteBase';

export const EditEventPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const routeBase = useRouteBase();

    const { data: event, isLoading, isError } = useEvent(id || '');

    const handleSuccess = (updatedEvent: EventWithCounts) => {
        navigate(`${routeBase}/events/${updatedEvent.id}`);
    };

    const handleCancel = () => {
        navigate(`${routeBase}/events/${id}`);
    };

    if (isLoading) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
                <Loader size="l" />
            </div>
        );
    }

    if (isError || !event) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
                <div className="container max-w-2xl mx-auto px-4 py-6">
                    <Card className="p-6">
                        <h2 className="text-xl font-bold text-red-600">Event not found</h2>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
            <div className="container max-w-7xl mx-auto px-4 py-6">
                <EventForm event={event} onSuccess={handleSuccess} onCancel={handleCancel} />
            </div>
        </div>
    );
};
