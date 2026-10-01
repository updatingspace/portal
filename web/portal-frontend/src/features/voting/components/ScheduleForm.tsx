import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { dateTime } from '@gravity-ui/date-utils';
import { parseLocalDateTime } from '../../../shared/lib/dateTimeLocal';
import { FormField } from '../../../shared/ui/portal/PortalUI';
import { useFormatters } from '../../../shared/hooks/useFormatters';

export interface ScheduleFormProps {
  initialStartsAt?: string | null;
  initialEndsAt?: string | null;
  onUpdate: (payload: {
    starts_at: string | null;
    ends_at: string | null;
  }) => void;
  disabled?: boolean;
  locale?: string;
}
export function ScheduleForm({
  initialStartsAt,
  initialEndsAt,
  onUpdate,
  disabled = false,
}: ScheduleFormProps) {
  const t = useUITranslation();
  const { timezone } = useFormatters();
  const controlValue = (value?: string | null) =>
    value
      ? dateTime({ input: value, timeZone: timezone }).format(
          'YYYY-MM-DDTHH:mm',
        )
      : '';
  const parse = (value: string) => {
    if (!value) return null;
    const parsed = parseLocalDateTime(value, timezone);
    return parsed.isValid() ? parsed.toISOString() : null;
  };
  const invalid = Boolean(
    initialStartsAt &&
      initialEndsAt &&
      Date.parse(initialEndsAt) <= Date.parse(initialStartsAt),
  );
  return (
    <div className="voting-schedule">
      <p className="voting-v2__muted">
        {t('Часовой пояс:', 'Time zone:')}
        {timezone}
      </p>
      <div className="voting-schedule__fields">
        <FormField
          label={t('Начало голосования', 'Voting starts')}
          hint={t('Необязательно', 'Optional')}
        >
          {(props) => (
            <input
              {...props}
              className="portal-datetime"
              type="datetime-local"
              value={controlValue(initialStartsAt)}
              disabled={disabled}
              onChange={(event) =>
                onUpdate({
                  starts_at: parse(event.target.value),
                  ends_at: initialEndsAt ?? null,
                })
              }
            />
          )}
        </FormField>
        <FormField
          label={t('Окончание голосования', 'Voting ends')}
          hint={t('Необязательно', 'Optional')}
          error={
            invalid
              ? t(
                  'Окончание должно быть позже начала.',
                  'End time must be after start time.',
                )
              : undefined
          }
        >
          {(props) => (
            <input
              {...props}
              className="portal-datetime"
              type="datetime-local"
              value={controlValue(initialEndsAt)}
              disabled={disabled}
              onChange={(event) =>
                onUpdate({
                  starts_at: initialStartsAt ?? null,
                  ends_at: parse(event.target.value),
                })
              }
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
