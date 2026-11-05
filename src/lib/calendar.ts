import { formatInTimeZone } from 'date-fns-tz';

/**
 * Working calendar. A runway has N "working days"; Day i is the i-th working date counted
 * from its start date, skipping non-working weekdays and skipped (rest) dates. Steps stay
 * tied to the day number, so changing the calendar only moves dates, never tasks.
 *
 * Dates are plain calendar dates (YYYY-MM-DD) in the user's timezone. Pure and unit tested.
 */
export type Ymd = string;

export interface Schedule {
  startOn: Ymd | null;
  /** 0 = Sunday ... 6 = Saturday */
  workingWeekdays: number[];
  /** Rest dates inside the plan (holidays, postponed gaps) */
  skipDates: Ymd[];
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MS_DAY = 86_400_000;
const MAX_SCAN = 4000; // safety bound for date scans

export const isYmd = (v: unknown): v is Ymd => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = Date.parse(`${v}T00:00:00Z`);
  // Rejects impossible dates such as 2026-13-45 or 2026-02-30
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v;
};

const toMs = (d: Ymd) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number): Ymd => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: Ymd, n: number): Ymd => fromMs(toMs(d) + n * MS_DAY);
export const diffDays = (a: Ymd, b: Ymd): number => Math.round((toMs(b) - toMs(a)) / MS_DAY);
export const weekdayOf = (d: Ymd): number => new Date(`${d}T00:00:00Z`).getUTCDay();

/** Calendar date of a timestamp in the given timezone. */
export function ymdInTz(date: Date | string, tz: string): Ymd {
  try {
    return formatInTimeZone(new Date(date), tz, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(new Date(date), 'UTC', 'yyyy-MM-dd');
  }
}

export const todayInTz = (tz: string, now = new Date()): Ymd => ymdInTz(now, tz);

/** Timestamp (UTC noon) used where a legacy Date field must mirror a calendar date. */
export const ymdToDate = (d: Ymd): Date => new Date(`${d}T12:00:00Z`);

export function isWorkingDate(s: Schedule, d: Ymd): boolean {
  return s.workingWeekdays.includes(weekdayOf(d)) && !s.skipDates.includes(d);
}

function assertWorkable(s: Schedule) {
  if (!s.workingWeekdays.length) throw new Error('At least one working weekday is required');
}

/** First working date on or after `from`. */
export function nextWorkingDate(s: Schedule, from: Ymd): Ymd {
  assertWorkable(s);
  let d = from;
  for (let i = 0; i < MAX_SCAN; i++, d = addDays(d, 1)) if (isWorkingDate(s, d)) return d;
  throw new Error('No working date found');
}

/** Date of 0-based day `dayIndex`; null when the schedule has no start date. */
export function dateForDay(s: Schedule, dayIndex: number): Ymd | null {
  if (!s.startOn) return null;
  assertWorkable(s);
  let count = -1;
  let d = s.startOn;
  for (let i = 0; i < MAX_SCAN; i++, d = addDays(d, 1)) {
    if (isWorkingDate(s, d) && ++count === dayIndex) return d;
  }
  throw new Error('Day is out of range');
}

export const endOn = (s: Schedule, dayCount: number): Ymd | null =>
  s.startOn ? dateForDay(s, dayCount - 1) : null;

export function calendar(s: Schedule, dayCount: number) {
  return Array.from({ length: dayCount }, (_, dayIndex) => ({
    dayIndex,
    date: dateForDay(s, dayIndex),
  }));
}

export type DayState =
  | { state: 'unscheduled' }
  | { state: 'upcoming'; startsOn: Ymd; daysUntil: number }
  | { state: 'working'; dayIndex: number }
  | { state: 'rest'; nextDayIndex: number | null; nextDate: Ymd | null }
  | { state: 'ended'; endedOn: Ymd };

/** Where `today` falls in the schedule. */
export function dayStateFor(s: Schedule, dayCount: number, today: Ymd): DayState {
  if (!s.startOn) return { state: 'unscheduled' };
  const end = endOn(s, dayCount)!;
  if (today < s.startOn) {
    return { state: 'upcoming', startsOn: s.startOn, daysUntil: diffDays(today, s.startOn) };
  }
  if (today > end) return { state: 'ended', endedOn: end };

  // Count working days from the start up to today
  let index = -1;
  let d = s.startOn;
  for (let i = 0; i < MAX_SCAN && d <= today; i++, d = addDays(d, 1)) {
    if (isWorkingDate(s, d)) index++;
  }
  if (isWorkingDate(s, today)) return { state: 'working', dayIndex: index };
  const nextDayIndex = index + 1 < dayCount ? index + 1 : null;
  return {
    state: 'rest',
    nextDayIndex,
    nextDate: nextDayIndex === null ? null : dateForDay(s, nextDayIndex),
  };
}

/** 0-based day number for `today`, clamped into the plan (before start => 0, after end => last). */
export function clampedDayIndex(s: Schedule, dayCount: number, today: Ymd): number {
  const st = dayStateFor(s, dayCount, today);
  switch (st.state) {
    case 'working':
      return st.dayIndex;
    case 'rest':
      return st.nextDayIndex ?? dayCount - 1;
    case 'ended':
      return dayCount - 1;
    default:
      return 0;
  }
}

// ----------------------------------------------------------------- operations
/** Moves the whole plan to start on `newStart` (rest dates move with it). */
export function shiftTo(s: Schedule, newStart: Ymd): Schedule {
  if (!s.startOn) return { ...s, startOn: nextWorkingDate(s, newStart) };
  const delta = diffDays(s.startOn, newStart);
  const moved: Schedule = {
    ...s,
    startOn: newStart,
    skipDates: s.skipDates.map((d) => addDays(d, delta)),
  };
  return { ...moved, startOn: nextWorkingDate(moved, newStart) };
}

/**
 * Pushes day `fromDay` and everything after it forward by `count` working days by adding
 * rest dates (the next `count` working dates starting at that day's date).
 */
export function postponeFrom(s: Schedule, fromDay: number, count: number): Schedule {
  const first = dateForDay(s, fromDay);
  if (!first) throw new Error('Schedule has no start date');
  const added: Ymd[] = [];
  let d = first;
  for (let i = 0; i < MAX_SCAN && added.length < count; i++, d = addDays(d, 1)) {
    if (isWorkingDate(s, d)) added.push(d);
  }
  return { ...s, skipDates: Array.from(new Set([...s.skipDates, ...added])).sort() };
}

/** Human label, e.g. "Tue 12 Nov". */
export function formatDayLabel(d: Ymd): string {
  return formatInTimeZone(new Date(`${d}T12:00:00Z`), 'UTC', 'EEE d MMM');
}
