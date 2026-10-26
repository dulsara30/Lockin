import { formatInTimeZone } from 'date-fns-tz';

/**
 * Calendar-day helpers. Runway "days" are consecutive calendar days starting on the
 * calendar date of the start timestamp in the user's timezone (not 24-hour blocks).
 */
const MS_DAY = 24 * 60 * 60 * 1000;

function ymd(date: Date, tz: string): string {
  try {
    return formatInTimeZone(date, tz, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');
  }
}

const utcMidnight = (s: string) => Date.parse(`${s}T00:00:00Z`);

/** Calendar date (YYYY-MM-DD) of 0-based `dayIndex` for a runway/mission starting at `start`. */
export function dayDate(start: Date | string, dayIndex: number, tz: string): string {
  const base = utcMidnight(ymd(new Date(start), tz));
  return new Date(base + dayIndex * MS_DAY).toISOString().slice(0, 10);
}

/**
 * 0-based day index of `now` relative to `start` (negative before the start date).
 * Callers decide how to clamp.
 */
export function dayIndexForDate(start: Date | string, now: Date, tz: string): number {
  return Math.round((utcMidnight(ymd(now, tz)) - utcMidnight(ymd(new Date(start), tz))) / MS_DAY);
}
