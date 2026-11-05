'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import { updateSettingsAction } from '@/features/settings/actions';
import { WEEKDAY_NAMES } from '@/lib/calendar';
import { cn } from '@/lib/utils';

interface Props {
  initialWeekdays: number[];
  initialStrict: boolean;
}

/** Default working week for new runways, and strict (no past dates) mode. */
export function CalendarSettings({ initialWeekdays, initialStrict }: Props) {
  const [weekdays, setWeekdays] = React.useState(initialWeekdays);
  const [strict, setStrict] = React.useState(initialStrict);
  const [busy, setBusy] = React.useState(false);

  const save = async (patch: { workingWeekdays?: number[]; strictSchedule?: boolean }) => {
    setBusy(true);
    const res = await updateSettingsAction(patch);
    setBusy(false);
    if (res.success) toast.success('Saved');
    else toast.error(res.error || 'Could not save');
    return res.success;
  };

  const toggleDay = async (d: number) => {
    const next = weekdays.includes(d)
      ? weekdays.filter((x) => x !== d)
      : [...weekdays, d].sort((a, b) => a - b);
    if (next.length === 0) {
      toast.error('Keep at least one working day');
      return;
    }
    const prev = weekdays;
    setWeekdays(next);
    if (!(await save({ workingWeekdays: next }))) setWeekdays(prev);
  };

  const toggleStrict = async () => {
    const next = !strict;
    setStrict(next);
    if (!(await save({ strictSchedule: next }))) setStrict(!next);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Calendar & schedule
        </h3>
        <p className="text-xs text-muted-foreground">
          Defaults for new missions and runways. Each runway can still override its working days.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Working days</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              disabled={busy}
              aria-pressed={weekdays.includes(d)}
              onClick={() => toggleDay(d)}
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
          Day numbers only count these weekdays. All seven are on by default.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-3">
        <input
          type="checkbox"
          checked={strict}
          disabled={busy}
          onChange={toggleStrict}
          className="mt-0.5 h-4 w-4 rounded accent-primary"
        />
        <span className="space-y-0.5">
          <span className="block text-xs font-semibold text-foreground">Strict schedule</span>
          <span className="block text-[11px] text-muted-foreground">
            On: no past dates anywhere. You cannot create, start or shift a runway into the past,
            move or add tasks on past days, or replan onto them. If you miss days, shift forward or
            replan. Off: past dates are allowed.
          </span>
        </span>
      </label>
    </div>
  );
}
