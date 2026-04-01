/**
 * TimezoneSelector - Timezone selection with grouped options
 */
import { Select, type SelectOption } from '@gravity-ui/uikit';
import { useCallback, useMemo } from 'react';

import './settings.css';

export interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

interface TimezoneConfig {
  value: string;
  label: string;
  offset: string;
  region: string;
}

const TIMEZONE_OPTIONS: TimezoneConfig[] = [
  // Europe
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00', region: 'Universal' },
  { value: 'Europe/London', label: 'London', offset: '+00:00', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris / Berlin', offset: '+01:00', region: 'Europe' },
  { value: 'Europe/Tallinn', label: 'Tallinn / Helsinki', offset: '+02:00', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow', offset: '+03:00', region: 'Europe' },
  // Americas
  { value: 'America/New_York', label: 'New York (Eastern)', offset: '-05:00', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago (Central)', offset: '-06:00', region: 'Americas' },
  { value: 'America/Denver', label: 'Denver (Mountain)', offset: '-07:00', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', offset: '-08:00', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', offset: '-03:00', region: 'Americas' },
  // Asia
  { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Mumbai / New Delhi', offset: '+05:30', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul', offset: '+09:00', region: 'Asia' },
  // Pacific
  { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00', region: 'Pacific' },
  { value: 'Pacific/Auckland', label: 'Auckland', offset: '+12:00', region: 'Pacific' },
];

export function TimezoneSelector({ value, onChange, disabled }: TimezoneSelectorProps) {
  const selectOptions: SelectOption[] = useMemo(() => {
    const grouped: Record<string, TimezoneConfig[]> = {};
    
    TIMEZONE_OPTIONS.forEach((tz) => {
      if (!grouped[tz.region]) {
        grouped[tz.region] = [];
      }
      grouped[tz.region].push(tz);
    });

    const options: SelectOption[] = [];
    
    Object.entries(grouped).forEach(([region, timezones]) => {
      options.push({
        value: `__group_${region}`,
        content: region,
        disabled: true,
      });
      
      timezones.forEach((tz) => {
        options.push({
          value: tz.value,
          content: `${tz.label} (UTC${tz.offset})`,
        });
      });
    });

    return options;
  }, []);

  const handleChange = useCallback(
    (values: string[]) => {
      const selected = values[0];
      if (selected && !selected.startsWith('__group_')) {
        onChange(selected);
      }
    },
    [onChange]
  );

  return (
    <Select
      value={[value]}
      onUpdate={handleChange}
      options={selectOptions}
      disabled={disabled}
      width="max"
      size="m"
      placeholder="Select timezone"
      filterable
      aria-label="Select timezone"
      data-testid="timezone-selector"
    />
  );
}
