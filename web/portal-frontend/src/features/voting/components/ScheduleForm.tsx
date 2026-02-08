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

  const candidate = value as { toDate?: () => Date; toJSDate?: () => Date; year?: number; month?: number; date?: number };

  if (typeof candidate.toDate === 'function') {
    const result = candidate.toDate();
    return Number.isNaN(result.getTime()) ? null : result;
  }

  if (typeof candidate.toJSDate === 'function') {
    const result = candidate.toJSDate();
    return Number.isNaN(result.getTime()) ? null : result;
  }

  if (
    typeof candidate.year === 'number' &&
    typeof candidate.month === 'number' &&
    typeof candidate.date === 'number'
  ) {
    return new Date(candidate.year, candidate.month - 1, candidate.date);
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

const timeInputClassName = 'voting-schedule__input';

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
  const uid = React.useId();
  const startDateLabelId = `${uid}-start-date-label`;
  const endDateLabelId = `${uid}-end-date-label`;
  const startTimeId = `${uid}-start-time`;
  const endTimeId = `${uid}-end-time`;
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
    <div className="voting-schedule">
      <div className="voting-schedule__grid">
        <div>
          <label className="voting-form__label" id={startDateLabelId}>
            Дата начала
          </label>
          <div className="voting-schedule__calendar">
            <Calendar
              value={toCalendarValue(startDate)}
              onUpdate={handleStartCalendarUpdate}
              disabled={disabled}
              aria-labelledby={startDateLabelId}
            />
          </div>
        </div>
        
        <div>
          <label className="voting-form__label" htmlFor={startTimeId}>
            Время начала
          </label>
          <input
            id={startTimeId}
            type="time"
            value={startTime}
            onChange={(event) => handleStartTimeUpdate(event.target.value)}
            disabled={disabled}
            className={timeInputClassName}
          />
        </div>
      </div>
      
      <div className="voting-schedule__grid">
        <div>
          <label className="voting-form__label" id={endDateLabelId}>
            Дата окончания
          </label>
          <div className="voting-schedule__calendar">
            <Calendar
              value={toCalendarValue(endDate)}
              onUpdate={handleEndCalendarUpdate}
              disabled={disabled}
              aria-labelledby={endDateLabelId}
            />
          </div>
        </div>
        
        <div>
          <label className="voting-form__label" htmlFor={endTimeId}>
            Время окончания
          </label>
          <input
            id={endTimeId}
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
