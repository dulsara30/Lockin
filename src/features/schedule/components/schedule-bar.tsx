'use client';

import * as React from 'react';
import { CalendarClock, CalendarDays, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdjustScheduleDialog } from '@/features/schedule/components/adjust-schedule-dialog';
import type { CalendarView } from '@/server/dal/schedule';
import { formatDayLabel } from '@/lib/calendar';

interface Props {
  runwayId: string;
  calendar: CalendarView;
  canEdit: boolean;
}

/** One-line schedule status for a runway, with the start / adjust action for editors. */
export function ScheduleBar({ runwayId, calendar, canEdit }: Props) {
  const [open, setOpen] = React.useState(false);
  const t = calendar.today;
  const range =
    calendar.startOn && calendar.endOn
      ? `${formatDayLabel(calendar.startOn)} → ${formatDayLabel(calendar.endOn)}`
      : null;

  let text: string;
  switch (t.state) {
    case 'unscheduled':
      text = `Not scheduled · ${calendar.dayCount} working days. Start it when you are ready.`;
      break;
    case 'upcoming':
      text = `Starts ${formatDayLabel(t.startsOn)} (in ${t.daysUntil} day${t.daysUntil === 1 ? '' : 's'}) · ${range}`;
      break;
    case 'working':
      text = `Day ${t.dayIndex + 1} of ${calendar.dayCount} · ${range}`;
      break;
    case 'rest':
      text = `Rest day${t.nextDate ? ` · next: Day ${(t.nextDayIndex ?? 0) + 1} on ${formatDayLabel(t.nextDate)}` : ''} · ${range}`;
      break;
    case 'ended':
      text = `Ended on ${formatDayLabel(t.endedOn)} · ${range}`;
      break;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/70 px-4 py-2.5">
      <p className="flex items-center gap-2 text-xs text-foreground">
        <CalendarDays className="h-4 w-4 text-primary shrink-0" />
        <span>{text}</span>
      </p>
      {canEdit && (
        <>
          <Button
            size="sm"
            variant={t.state === 'unscheduled' ? 'default' : 'outline'}
            onClick={() => setOpen(true)}
            className={
              t.state === 'unscheduled'
                ? 'bg-primary hover:bg-primary-hover text-white text-xs gap-1.5'
                : 'text-xs gap-1.5 border-border bg-background hover:bg-surface'
            }
          >
            {t.state === 'unscheduled' ? (
              <Play className="h-3.5 w-3.5 fill-current" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
            )}
            <span>{t.state === 'unscheduled' ? 'Start runway' : 'Adjust schedule'}</span>
          </Button>
          <AdjustScheduleDialog
            runwayId={runwayId}
            calendar={calendar}
            open={open}
            onOpenChange={setOpen}
          />
        </>
      )}
    </div>
  );
}
