import React from 'react';
import {Label} from '@gravity-ui/uikit';
import type {RsvpCounts} from '../types';

export interface EventRsvpCountsProps {
  counts: RsvpCounts;
  compact?: boolean;
}

export const EventRsvpCounts: React.FC<EventRsvpCountsProps> = ({counts, compact = false}) => {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        <Label theme="success" size="s">Идут: {counts.going}</Label>
        <Label theme="info" size="s">Интересуются: {counts.interested}</Label>
        <Label theme="danger" size="s">Не пойдут: {counts.not_going}</Label>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-stretch justify-center gap-3">
      <div className="min-w-[110px] rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-center">
        <div className="text-xl font-semibold text-emerald-900 leading-none">{counts.going}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-800/80">Идут</div>
      </div>

      <div className="min-w-[140px] rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-center">
        <div className="text-xl font-semibold text-sky-900 leading-none">{counts.interested}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-sky-800/80">
          Интересуются
        </div>
      </div>

      <div className="min-w-[130px] rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-center">
        <div className="text-xl font-semibold text-rose-900 leading-none">{counts.not_going}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-rose-800/80">Не пойдут</div>
      </div>
    </div>
  );
};
