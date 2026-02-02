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
        <div className="container py-4 max-w-2xl mx-auto">
            <EventForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
    );
};
