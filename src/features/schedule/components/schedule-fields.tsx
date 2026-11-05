'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSettingsAction } from '@/features/settings/actions';
import { WEEKDAY_NAMES, ALL_WEEKDAYS, formatDayLabel, todayInTz } from '@/lib/calendar';
import { MAX_DAYS, validateNewSchedule } from '@/lib/schedule';
import { cn } from '@/lib/utils';

export type ScheduleMode = 'later' | 'start' | 'range';

export interface ScheduleChoice {
  mode: ScheduleMode;
  dayCount: number;
  startOn: string;
  endOn: string;
  workingWeekdays: number[];
}

export interface SchedulePayload {
  dayCount?: number;
  startOn?: string;
  endOn?: string;
  workingWeekdays: number[];
}

export const defaultChoice = (dayCount = 5): ScheduleChoice => ({
  mode: 'later',
  dayCount,
  startOn: '',
  endOn: '',
  workingWeekdays: ALL_WEEKDAYS,
});

/** What to send to the server for a choice. */
export function toPayload(c: ScheduleChoice): SchedulePayload {
  const base = { workingWeekdays: c.workingWeekdays };
  if (c.mode === 'later') return { ...base, dayCount: c.dayCount };
  if (c.mode === 'start') return { ...base, dayCount: c.dayCount, startOn: c.startOn || undefined };
  return { ...base, startOn: c.startOn || undefined, endOn: c.endOn || undefined };
}

interface Defaults {
  timezone: string;
  strict: boolean;
  workingWeekdays: number[];
}

/** The user's calendar settings (timezone, strict mode, default working week). */
export function useScheduleDefaults(): Defaults | null {
  const [defaults, setDefaults] = React.useState<Defaults | null>(null);
  React.useEffect(() => {
    let alive = true;
    getSettingsAction().then((res) => {
      if (!alive) return;
      const s = res.success && res.settings ? res.settings : null;
      setDefaults({
        timezone: s?.timezone ?? 'UTC',
        strict: s?.strictSchedule ?? true,
        workingWeekdays: s?.workingWeekdays ?? ALL_WEEKDAYS,
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  return defaults;
}

/** Validates a choice the same way the server does; used for live feedback and submit. */
export function checkChoice(c: ScheduleChoice, d: Defaults | null) {
  const ctx = {
    today: todayInTz(d?.timezone ?? 'UTC'),
    strict: d?.strict ?? true,
    defaultWeekdays: d?.workingWeekdays,
  };
  return validateNewSchedule(toPayload(c), ctx);
}

const MODES: { value: ScheduleMode; title: string; hint: string }[] = [
  { value: 'later', title: 'Duration only', hint: 'Start it later' },
  { value: 'start', title: 'Duration + start date', hint: 'Plan ahead' },
  { value: 'range', title: 'Start + end dates', hint: 'Fixed window' },
];

interface ScheduleFieldsProps {
  value: ScheduleChoice;
  onChange: (next: ScheduleChoice) => void;
  defaults: Defaults | null;
  /** Limit the choices (e.g. a generated plan already has a fixed length) */
  modes?: ScheduleMode[];
  lockDuration?: boolean;
}

export function ScheduleFields({
  value,
  onChange,
  defaults,
  modes,
  lockDuration = false,
}: ScheduleFieldsProps) {
  const set = (patch: Partial<ScheduleChoice>) => onChange({ ...value, ...patch });
  const today = todayInTz(defaults?.timezone ?? 'UTC');
  const min = defaults?.strict === false ? undefined : today;
  const result = checkChoice(value, defaults);

  const toggleDay = (d: number) =>
    set({
      workingWeekdays: value.workingWeekdays.includes(d)
        ? value.workingWeekdays.filter((x) => x !== d)
        : [...value.workingWeekdays, d].sort((a, b) => a - b),
    });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <CalendarDays className="h-3.5 w-3.5 text-primary" />
        <span>Schedule</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5" role="radiogroup">
        {MODES.filter((m) => !modes || modes.includes(m.value)).map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value.mode === m.value}
            onClick={() => set({ mode: m.value })}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
              value.mode === m.value
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="block font-semibold">{m.title}</span>
            <span className="block text-[10px] opacity-80">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {value.mode !== 'range' && (
          <div className="space-y-1.5">
            <Label htmlFor="sch-days" className="text-xs">
              Duration (working days)
            </Label>
            <Input
              id="sch-days"
              type="number"
              min={1}
              max={MAX_DAYS}
              value={value.dayCount}
              disabled={lockDuration}
              onChange={(e) => set({ dayCount: Number(e.target.value) })}
              className="font-mono text-sm"
            />
          </div>
        )}
        {value.mode !== 'later' && (
          <div className="space-y-1.5">
            <Label htmlFor="sch-start" className="text-xs">
              Start date
            </Label>
            <Input
              id="sch-start"
              type="date"
              min={min}
              value={value.startOn}
              onChange={(e) => set({ startOn: e.target.value })}
              className="font-mono text-sm"
            />
          </div>
        )}
        {value.mode === 'range' && (
          <div className="space-y-1.5">
            <Label htmlFor="sch-end" className="text-xs">
              End date
            </Label>
            <Input
              id="sch-end"
              type="date"
              min={value.startOn || min}
              value={value.endOn}
              onChange={(e) => set({ endOn: e.target.value })}
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Working days</Label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={value.workingWeekdays.includes(d)}
              onClick={() => toggleDay(d)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                value.workingWeekdays.includes(d)
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border bg-surface text-muted-foreground'
              )}
            >
              {WEEKDAY_NAMES[d]}
            </button>
          ))}
        </div>
      </div>

      <p
        className={cn(
          'text-[11px]',
          result.ok ? 'text-muted-foreground' : 'text-danger font-medium'
        )}
        role={result.ok ? undefined : 'alert'}
      >
        {result.ok
          ? result.value.startOn
            ? `${result.value.dayCount} working days: ${formatDayLabel(result.value.startOn)} to ${formatDayLabel(result.value.endOn!)}.`
            : `${result.value.dayCount} working days, no dates yet. You set the start date when you start it.`
          : result.errors[0]}
      </p>
    </div>
  );
}
