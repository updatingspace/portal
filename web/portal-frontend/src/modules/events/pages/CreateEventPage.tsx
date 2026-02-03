import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EventForm } from '../../../features/events/components';
import type { EventWithCounts } from '../../../features/events';

export const CreateEventPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSuccess = (event: EventWithCounts) => {
        navigate(`/app/events/${event.id}`);
    };

    const handleCancel = () => {
        navigate('/app/events');
    };

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950">
            <div className="container max-w-7xl mx-auto px-4 py-6">
                <EventForm onSuccess={handleSuccess} onCancel={handleCancel} />
            </div>
        </div>
    );
};
