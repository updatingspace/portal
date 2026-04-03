/**
 * Calendar view for modal scheduling
 * Shows modals on a timeline with drag-to-reschedule support
 */
import { Button, Card, Icon, Label, Select, Text } from '@gravity-ui/uikit';
import { ChevronLeft, ChevronRight, Eye, Pencil } from '@gravity-ui/icons';
import { useCallback, useMemo, useState } from 'react';
import type { HomePageModal, ModalType } from '../../types';
import { getModalTypeColor, getModalTypeLabel } from '../../utils';
import './CalendarView.css';

interface CalendarViewProps {
  modals: HomePageModal[];
  onEdit: (modal: HomePageModal) => void;
  onPreview: (modal: HomePageModal) => void;
  onReschedule?: (modalId: number, startDate: Date, endDate: Date) => Promise<void>;
}

type ViewMode = 'month' | 'week';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function CalendarView({
  modals,
  onEdit,
  onPreview,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedModal, setSelectedModal] = useState<HomePageModal | null>(null);

  // Get start of week (Monday)
  const getStartOfWeek = useCallback((date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Navigate calendar
  const navigatePrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  }, [viewMode]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Generate calendar days for month view
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Monday of the week containing the first day
    const startDate = getStartOfWeek(firstDay);
    
    // Generate 6 weeks of days
    const days: Date[] = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return { days, month, year, lastDay };
  }, [currentDate, getStartOfWeek]);

  // Generate days for week view
  const weekDays = useMemo(() => {
    const startOfWeek = getStartOfWeek(currentDate);
    const days: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    
    return days;
  }, [currentDate, getStartOfWeek]);

  // Get modals for a specific day
  const getModalsForDay = useCallback((date: Date): HomePageModal[] => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return modals.filter(modal => {
      // Skip deleted modals
      if (modal.deleted_at) return false;
      
      // Modal with no dates is always shown
      if (!modal.start_date && !modal.end_date) return false;
      
      const startDate = modal.start_date ? new Date(modal.start_date) : null;
      const endDate = modal.end_date ? new Date(modal.end_date) : null;
      
      // Check if day is within modal's date range
      if (startDate && endDate) {
        return dayStart <= endDate && dayEnd >= startDate;
      } else if (startDate) {
        return dayEnd >= startDate;
      } else if (endDate) {
        return dayStart <= endDate;
      }
      
      return false;
    });
  }, [modals]);

  // Check if date is today
  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  // Check if date is in current month
  const isCurrentMonth = useCallback((date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  }, [currentDate]);

  // Render modal item
  const renderModalItem = useCallback((modal: HomePageModal, compact = false) => {
    return (
      <div
        key={modal.id}
        className={`calendar-modal ${compact ? 'calendar-modal--compact' : ''} ${
          selectedModal?.id === modal.id ? 'calendar-modal--selected' : ''
        } ${!modal.is_active ? 'calendar-modal--inactive' : ''}`}
        onClick={() => setSelectedModal(modal)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedModal(modal);
          }
        }}
      >
        <div 
          className="calendar-modal__indicator"
          style={{ backgroundColor: getTypeColor(modal.modal_type) }}
        />
        <span className="calendar-modal__title" title={modal.title}>
          {compact ? truncate(modal.title, 15) : truncate(modal.title, 25)}
        </span>
        {!compact && modal.is_active && (
          <span className="calendar-modal__badge calendar-modal__badge--active">●</span>
        )}
      </div>
    );
  }, [selectedModal]);

  // Render day cell
  const renderDayCell = useCallback((date: Date) => {
    const dayModals = getModalsForDay(date);
    const isCurrentMonthDay = isCurrentMonth(date);
    const isTodayDay = isToday(date);
    const maxVisible = viewMode === 'month' ? 3 : 5;
    const hiddenCount = Math.max(0, dayModals.length - maxVisible);

    return (
      <div
        key={date.toISOString()}
        className={`calendar-day ${!isCurrentMonthDay ? 'calendar-day--other-month' : ''} ${
          isTodayDay ? 'calendar-day--today' : ''
        } ${viewMode === 'week' ? 'calendar-day--week' : ''}`}
      >
        <div className="calendar-day__header">
          <span className={`calendar-day__number ${isTodayDay ? 'calendar-day__number--today' : ''}`}>
            {date.getDate()}
          </span>
          {viewMode === 'week' && (
            <span className="calendar-day__weekday">
              {DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1]}
            </span>
          )}
        </div>
        <div className="calendar-day__modals">
          {dayModals.slice(0, maxVisible).map(modal => 
            renderModalItem(modal, viewMode === 'month')
          )}
          {hiddenCount > 0 && (
            <div className="calendar-day__more">
              +{hiddenCount} more
            </div>
          )}
        </div>
      </div>
    );
  }, [getModalsForDay, isCurrentMonth, isToday, viewMode, renderModalItem]);

  // Render month title
  const title = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    
    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()}-${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    }
    
    return `${MONTHS[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
  }, [currentDate, viewMode, getStartOfWeek]);

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="calendar-view__header">
        <div className="calendar-view__navigation">
          <Button view="flat" onClick={navigatePrev}>
            <Icon data={ChevronLeft} />
          </Button>
          <Button view="flat" onClick={navigateToday}>
            Today
          </Button>
          <Button view="flat" onClick={navigateNext}>
            <Icon data={ChevronRight} />
          </Button>
        </div>

        <Text variant="header-1" className="calendar-view__title">
          {title}
        </Text>

        <div className="calendar-view__controls">
          <Select
            value={[viewMode]}
            options={[
              { value: 'month', content: 'Month' },
              { value: 'week', content: 'Week' },
            ]}
            onUpdate={([value]) => setViewMode(value as ViewMode)}
            width={120}
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`calendar-grid calendar-grid--${viewMode}`}>
        {/* Day headers */}
        {viewMode === 'month' && (
          <div className="calendar-grid__header">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="calendar-grid__day-name">
                {day}
              </div>
            ))}
          </div>
        )}

        {/* Days */}
        <div className="calendar-grid__body">
          {(viewMode === 'month' ? monthDays.days : weekDays).map(day => renderDayCell(day))}
        </div>
      </div>

      {/* Modal Details Panel */}
      {selectedModal && (
        <Card className="calendar-details">
          <div className="calendar-details__header">
            <Text variant="subheader-1">{selectedModal.title}</Text>
            <Button view="flat" size="s" onClick={() => setSelectedModal(null)}>
              ×
            </Button>
          </div>
          
          <div className="calendar-details__body">
            <div className="calendar-details__row">
              <Text variant="body-1" color="secondary">Type</Text>
              <Label theme={getModalTypeColor(selectedModal.modal_type)} size="s">
                {getModalTypeLabel(selectedModal.modal_type)}
              </Label>
            </div>
            
            <div className="calendar-details__row">
              <Text variant="body-1" color="secondary">Status</Text>
              <Label theme={selectedModal.is_active ? 'success' : 'normal'} size="s">
                {selectedModal.is_active ? 'Active' : 'Inactive'}
              </Label>
            </div>
            
            {selectedModal.start_date && (
              <div className="calendar-details__row">
                <Text variant="body-1" color="secondary">Start</Text>
                <Text variant="body-1">
                  {new Date(selectedModal.start_date).toLocaleDateString()}
                </Text>
              </div>
            )}
            
            {selectedModal.end_date && (
              <div className="calendar-details__row">
                <Text variant="body-1" color="secondary">End</Text>
                <Text variant="body-1">
                  {new Date(selectedModal.end_date).toLocaleDateString()}
                </Text>
              </div>
            )}
            
            <div className="calendar-details__row">
              <Text variant="body-1" color="secondary">Order</Text>
              <Text variant="body-1">{selectedModal.order}</Text>
            </div>
          </div>
          
          <div className="calendar-details__actions">
            <Button 
              view="outlined" 
              size="s"
              onClick={() => onPreview(selectedModal)}
            >
              <Icon data={Eye} />
              Preview
            </Button>
            <Button 
              view="action" 
              size="s"
              onClick={() => onEdit(selectedModal)}
            >
              <Icon data={Pencil} />
              Edit
            </Button>
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        <Text variant="caption-1" color="secondary">Modal Types:</Text>
        {(['info', 'warning', 'success', 'promo'] as ModalType[]).map(type => (
          <div key={type} className="calendar-legend__item">
            <span 
              className="calendar-legend__color"
              style={{ backgroundColor: getTypeColor(type as ModalType) }}
            />
            <Text variant="caption-1">{getModalTypeLabel(type as ModalType)}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

function getTypeColor(type: ModalType): string {
  const colors: Record<ModalType, string> = {
    info: 'var(--g-color-base-info)',
    warning: 'var(--g-color-base-warning)',
    success: 'var(--g-color-base-positive)',
    promo: 'var(--g-color-base-special)',
  };
  return colors[type] || colors.info;
}
