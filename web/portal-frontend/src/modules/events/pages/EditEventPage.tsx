import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, Card } from '@gravity-ui/uikit';
import { useEvent } from '../../../features/events';
import { EventForm } from '../../../features/events/components';
import type { EventWithCounts } from '../../../features/events';

export const EditEventPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: event, isLoading, isError } = useEvent(id || '');

    const handleSuccess = (updatedEvent: EventWithCounts) => {
        navigate(`/app/events/${updatedEvent.id}`);
    };

    const handleCancel = () => {
        navigate(`/app/events/${id}`);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader size="l" />
            </div>
        );
    }

    if (isError || !event) {
        return (
            <div className="container py-4 max-w-2xl mx-auto">
                <Card className="p-6">
                    <h2 className="text-xl font-bold text-red-600">Event not found</h2>
                </Card>
            </div>
        );
    }

    return (
        <div className="container py-4 max-w-2xl mx-auto">
            <EventForm event={event} onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
    );
};
