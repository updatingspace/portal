import React, { useState } from 'react';
import { Calendar } from '@gravity-ui/date-components';
import { dateTime, settings } from '@gravity-ui/date-utils';

// Helper functions for date handling
const toControlDatetime = (value: Date | string | null | undefined) => {
  if (!value) {
    return '';
  }
  const normalized = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(normalized.getTime())) {
    return '';
  }
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const date = String(normalized.getDate()).padStart(2, '0');
  const hours = String(normalized.getHours()).padStart(2, '0');
  const minutes = String(normalized.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${date}T${hours}:${minutes}`;
};

const parseControlDatetime = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTimeValue = (date: Date | null) => {
  if (!date) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const applyTimeToDate = (baseDate: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
  if (Number.isFinite(hours)) {
    baseDate.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  }
  return baseDate;
};

type CalendarValue = React.ComponentProps<typeof Calendar>['value'];

const toCalendarValue = (date: Date | null): CalendarValue => {
  if (!date) return null;
  // Convert Date to DateTime object that Calendar expects
  return dateTime({ input: date }) as CalendarValue;
};

const toJsDate = (value: CalendarValue): Date | null => {
  if (!value) return null;
  if (typeof value !== 'object') return null;

  const maybe = value as unknown as Record<string, unknown>;

  const toDate = maybe.toDate;
  if (typeof toDate === 'function') {
    const result = (toDate as () => Date)();
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const toJSDate = maybe.toJSDate;
  if (typeof toJSDate === 'function') {
    const result = (toJSDate as () => Date)();
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const year = maybe.year;
  const month = maybe.month;
  const date = maybe.date;
  if (typeof year === 'number' && typeof month === 'number' && typeof date === 'number') {
    return new Date(year, month - 1, date);
  }

  return null;
};

const mergeDatePart = (current: Date | null, next: Date | null) => {
  if (!next) return null;
  const base = new Date(next.getTime());
  const timeSource = current ?? new Date();
  base.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return base;
};

const timeInputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none';

export interface ScheduleFormProps {
  initialStartsAt?: string | null;
  initialEndsAt?: string | null;
  onUpdate: (payload: { starts_at: string | null; ends_at: string | null }) => void;
  disabled?: boolean;
  locale?: string;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({
  initialStartsAt,
  initialEndsAt,
  onUpdate,
  disabled = false,
  locale = 'ru',
}) => {
  const [startsAt, setStartsAt] = useState(() => toControlDatetime(initialStartsAt));
  const [endsAt, setEndsAt] = useState(() => toControlDatetime(initialEndsAt));
  
  // Load locale settings
  React.useEffect(() => {
    settings.loadLocale(locale).catch(() => undefined);
  }, [locale]);
  
  // Parse dates for calendar and time inputs
  const startDate = parseControlDatetime(startsAt);
  const endDate = parseControlDatetime(endsAt);
  const startTime = formatTimeValue(startDate);
  const endTime = formatTimeValue(endDate);
  
  const handleStartCalendarUpdate = (value: CalendarValue) => {
    const nextDate = mergeDatePart(startDate, toJsDate(value));
    const newStartsAt = nextDate ? toControlDatetime(nextDate) : '';
    setStartsAt(newStartsAt);
    onUpdate({
      starts_at: newStartsAt ? parseControlDatetime(newStartsAt)?.toISOString() ?? null : null,
      ends_at: endsAt ? parseControlDatetime(endsAt)?.toISOString() ?? null : null
    });
  };
  
  const handleEndCalendarUpdate = (value: CalendarValue) => {
    const nextDate = mergeDatePart(endDate, toJsDate(value));
    const newEndsAt = nextDate ? toControlDatetime(nextDate) : '';
    setEndsAt(newEndsAt);
    onUpdate({
      starts_at: startsAt ? parseControlDatetime(startsAt)?.toISOString() ?? null : null,
      ends_at: newEndsAt ? parseControlDatetime(newEndsAt)?.toISOString() ?? null : null
    });
  };
  
  const handleStartTimeUpdate = (value: string) => {
    const base = startDate ? new Date(startDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    const newStartsAt = toControlDatetime(nextDate);
    setStartsAt(newStartsAt);
    onUpdate({
      starts_at: newStartsAt ? parseControlDatetime(newStartsAt)?.toISOString() ?? null : null,
      ends_at: endsAt ? parseControlDatetime(endsAt)?.toISOString() ?? null : null
    });
  };
  
  const handleEndTimeUpdate = (value: string) => {
    const base = endDate ? new Date(endDate.getTime()) : new Date();
    const nextDate = applyTimeToDate(base, value);
    const newEndsAt = toControlDatetime(nextDate);
    setEndsAt(newEndsAt);
    onUpdate({
      starts_at: startsAt ? parseControlDatetime(startsAt)?.toISOString() ?? null : null,
      ends_at: newEndsAt ? parseControlDatetime(newEndsAt)?.toISOString() ?? null : null
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Дата начала
          </label>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Calendar
              value={toCalendarValue(startDate)}
              onUpdate={handleStartCalendarUpdate}
              disabled={disabled}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Время начала
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(event) => handleStartTimeUpdate(event.target.value)}
            disabled={disabled}
            className={timeInputClassName}
          />
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Дата окончания
          </label>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Calendar
              value={toCalendarValue(endDate)}
              onUpdate={handleEndCalendarUpdate}
              disabled={disabled}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Время окончания
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(event) => handleEndTimeUpdate(event.target.value)}
            disabled={disabled}
            className={timeInputClassName}
          />
        </div>
      </div>
    </div>
  );
};
