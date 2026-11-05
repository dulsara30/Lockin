'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  actionPostponeRunway,
  actionSetWorkingDays,
  actionShiftRunway,
  actionSkipDates,
  actionStartRunway,
} from '@/features/schedule/actions';
import type { CalendarView } from '@/server/dal/schedule';
import { WEEKDAY_NAMES, formatDayLabel } from '@/lib/calendar';
import { cn } from '@/lib/utils';

type Outcome =
  | { success: true; applied: boolean; calendar: CalendarView }
  | { success: false; errors: string[] };

type Tab = 'postpone' | 'shift' | 'weekdays' | 'rest';

interface Props {
  runwayId: string;
  calendar: CalendarView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'postpone', label: 'Postpone' },
  { id: 'shift', label: 'Shift all' },
  { id: 'weekdays', label: 'Working days' },
  { id: 'rest', label: 'Rest dates' },
];

export function AdjustScheduleDialog({ runwayId, calendar, open, onOpenChange }: Props) {
  const router = useRouter();
  const unscheduled = calendar.status === 'unscheduled';
  const firstFree = Math.min(calendar.lockedDays, calendar.dayCount - 1);

  const [tab, setTab] = React.useState<Tab>('postpone');
  const [startOn, setStartOn] = React.useState('');
  const [fromDay, setFromDay] = React.useState(firstFree);
  const [days, setDays] = React.useState(1);
  const [shiftTo, setShiftTo] = React.useState('');
  const [weekdays, setWeekdays] = React.useState<number[]>(calendar.workingWeekdays);
  const [restDate, setRestDate] = React.useState('');
  const [preview, setPreview] = React.useState<Outcome | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Reset when the dialog opens or the calendar changes underneath it
  React.useEffect(() => {
    if (open) {
      setWeekdays(calendar.workingWeekdays);
      setFromDay(Math.min(calendar.lockedDays, calendar.dayCount - 1));
      setPreview(null);
    }
  }, [open, calendar]);

  const min = calendar.strict ? undefined : undefined; // server enforces strict dates
  void min;

  const call = React.useCallback(
    async (dryRun: boolean): Promise<Outcome | null> => {
      if (unscheduled) {
        return actionStartRunway({ runwayId, startOn: startOn || undefined, dryRun });
      }
      switch (tab) {
        case 'postpone':
          return actionPostponeRunway({ runwayId, fromDay, days, dryRun });
        case 'shift':
          return shiftTo ? actionShiftRunway({ runwayId, startOn: shiftTo, dryRun }) : null;
        case 'weekdays':
          return actionSetWorkingDays({ runwayId, weekdays, dryRun });
        case 'rest':
          return null; // rest dates apply per click
      }
    },
    [runwayId, unscheduled, tab, startOn, fromDay, days, shiftTo, weekdays]
  );

  // Live preview of exactly what the server would do
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      const res = await call(true);
      if (alive) setPreview(res);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, call]);

  const apply = async () => {
    setBusy(true);
    const res = await call(false);
    setBusy(false);
    if (res?.success) {
      toast.success(unscheduled ? 'Runway started' : 'Schedule updated');
      onOpenChange(false);
      router.refresh();
    } else if (res) {
      toast.error(res.errors[0]);
    }
  };

  const rest = async (add: string[], remove: string[]) => {
    setBusy(true);
    const res = await actionSkipDates({ runwayId, add, remove });
    setBusy(false);
    if (res.success) {
      setRestDate('');
      toast.success('Rest dates updated');
      router.refresh();
    } else {
      toast.error(res.errors[0]);
    }
  };

  const next = preview?.success ? preview.calendar : null;
  const errors = preview && !preview.success ? preview.errors : [];
  const changed = (i: number) => next && next.days[i]?.date !== calendar.days[i]?.date;
  const shown = next ?? calendar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-surface border-border p-6 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarClock className="h-4 w-4 text-primary" />
            {unscheduled ? 'Start this runway' : 'Adjust schedule'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {unscheduled
              ? 'Pick the day this runway begins. Day 1 lands on that date (or the next working day) and every other date follows.'
              : 'Tasks stay on their day numbers; only the dates move. Days that are past or underway are locked.'}
          </DialogDescription>
        </DialogHeader>

        {unscheduled ? (
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-foreground" htmlFor="sched-start">
              Start date
            </label>
            <Input
              id="sched-start"
              type="date"
              value={startOn}
              onChange={(e) => setStartOn(e.target.value)}
              className="font-mono text-sm w-48"
            />
            <p className="text-[11px] text-muted-foreground">Leave empty to start today.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 pt-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    tab === t.id
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'postpone' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="space-y-1 text-xs font-semibold text-foreground">
                  From day
                  <select
                    value={fromDay}
                    onChange={(e) => setFromDay(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs"
                  >
                    {calendar.days.map((d) => (
                      <option key={d.dayIndex} value={d.dayIndex} disabled={d.locked}>
                        Day {d.dayIndex + 1}
                        {d.date ? ` · ${formatDayLabel(d.date)}` : ''}
                        {d.locked ? ' (locked)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-foreground">
                  Postpone by (working days)
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="mt-1 font-mono text-sm"
                  />
                </label>
                <p className="col-span-2 text-[11px] text-muted-foreground">
                  That day and every later day move forward, leaving rest days in between.
                </p>
              </div>
            )}

            {tab === 'shift' && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-foreground" htmlFor="sched-shift">
                  New start date
                </label>
                <Input
                  id="sched-shift"
                  type="date"
                  value={shiftTo}
                  onChange={(e) => setShiftTo(e.target.value)}
                  className="font-mono text-sm w-48"
                  disabled={calendar.lockedDays > 0}
                />
                <p className="text-[11px] text-muted-foreground">
                  {calendar.lockedDays > 0
                    ? 'Part of this runway is already past or underway, so it can no longer be shifted as a whole. Postpone from a later day instead.'
                    : 'Moves the whole runway, including rest dates.'}
                </p>
              </div>
            )}

            {tab === 'weekdays' && (
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={weekdays.includes(d)}
                      onClick={() =>
                        setWeekdays((w) =>
                          w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        weekdays.includes(d)
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      {WEEKDAY_NAMES[d]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only these weekdays count as working days for this runway.
                </p>
              </div>
            )}

            {tab === 'rest' && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={restDate}
                    onChange={(e) => setRestDate(e.target.value)}
                    className="font-mono text-sm w-48"
                    aria-label="Rest date"
                  />
                  <Button
                    size="sm"
                    disabled={!restDate || busy}
                    onClick={() => rest([restDate], [])}
                    className="text-xs"
                  >
                    Skip this date
                  </Button>
                </div>
                {calendar.skipDates.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No rest dates yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {calendar.skipDates.map((d) => (
                      <li
                        key={d}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]"
                      >
                        {formatDayLabel(d)}
                        <button
                          type="button"
                          aria-label={`Restore ${d}`}
                          onClick={() => rest([], [d])}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
          >
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {tab !== 'rest' || unscheduled ? (
          <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              {next
                ? `Preview: ${shown.startOn ? formatDayLabel(shown.startOn) : '—'} to ${shown.endOn ? formatDayLabel(shown.endOn) : '—'}`
                : 'Current schedule'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
              {shown.days.map((d, i) => (
                <span
                  key={d.dayIndex}
                  className={cn(
                    'rounded-lg border px-2 py-1 text-[11px] font-mono',
                    changed(i)
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground'
                  )}
                >
                  D{d.dayIndex + 1} · {d.date ? formatDayLabel(d.date) : 'no date'}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
          {(tab !== 'rest' || unscheduled) && (
            <Button
              size="sm"
              disabled={busy || !preview?.success}
              onClick={apply}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {unscheduled ? 'Start runway' : 'Apply'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
