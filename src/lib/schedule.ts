import {
  ALL_WEEKDAYS,
  Schedule,
  Ymd,
  addDays,
  calendar,
  dateForDay,
  diffDays,
  endOn,
  isWorkingDate,
  isYmd,
  nextWorkingDate,
  postponeFrom,
  shiftTo,
} from './calendar';

export const MAX_DAYS = 30;
export const MAX_AHEAD_DAYS = 365;
export const MAX_SKIP_DATES = 60;

export interface ScheduleCtx {
  /** Today in the user's timezone */
  today: Ymd;
  /** Strict mode: nothing may be created, started, shifted or moved into the past */
  strict: boolean;
  defaultWeekdays?: number[];
}

export interface ScheduleInput {
  dayCount?: number;
  startOn?: string | null;
  endOn?: string | null;
  workingWeekdays?: number[];
  skipDates?: string[];
}

export interface ScheduleValue {
  dayCount: number;
  startOn: Ymd | null;
  endOn: Ymd | null;
  workingWeekdays: number[];
  skipDates: Ymd[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const fail = (...errors: string[]): { ok: false; errors: string[] } => ({ ok: false, errors });

export function normalizeWeekdays(
  input: number[] | undefined,
  fallback = ALL_WEEKDAYS
): Result<number[]> {
  const list = input ?? fallback;
  if (!Array.isArray(list) || list.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return fail('Working weekdays must be numbers from 0 (Sunday) to 6 (Saturday).');
  }
  const unique = Array.from(new Set(list)).sort((a, b) => a - b);
  if (unique.length === 0) return fail('Choose at least one working weekday.');
  return { ok: true, value: unique };
}

function normalizeSkips(input: string[] | undefined, ctx: ScheduleCtx): Result<Ymd[]> {
  const list = input ?? [];
  if (list.length > MAX_SKIP_DATES) return fail(`At most ${MAX_SKIP_DATES} skipped dates.`);
  if (!list.every(isYmd)) return fail('Skipped dates must be valid dates (YYYY-MM-DD).');
  if (ctx.strict && list.some((d) => d < ctx.today)) {
    return fail("Skipped dates can't be in the past.");
  }
  return { ok: true, value: Array.from(new Set(list)).sort() };
}

const checkStart = (start: Ymd, ctx: ScheduleCtx): string | null => {
  if (ctx.strict && start < ctx.today) return "The start date can't be in the past.";
  if (diffDays(ctx.today, start) > MAX_AHEAD_DAYS) {
    return `The start date can be at most ${MAX_AHEAD_DAYS} days ahead.`;
  }
  return null;
};

/**
 * Validates a mission/runway being CREATED (or scheduled). A duration, or a start and an
 * end date, is required. The end date is always derived from the working calendar.
 */
export function validateNewSchedule(input: ScheduleInput, ctx: ScheduleCtx): Result<ScheduleValue> {
  const weekdays = normalizeWeekdays(input.workingWeekdays, ctx.defaultWeekdays);
  if (!weekdays.ok) return weekdays;
  const skips = normalizeSkips(input.skipDates, ctx);
  if (!skips.ok) return skips;

  const { startOn, endOn: endIn, dayCount } = input;
  if (startOn && !isYmd(startOn)) return fail('The start date is not a valid date.');
  if (endIn && !isYmd(endIn)) return fail('The end date is not a valid date.');
  if (
    dayCount !== undefined &&
    (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > MAX_DAYS)
  ) {
    return fail(`Duration must be between 1 and ${MAX_DAYS} working days.`);
  }

  const base: Schedule = {
    startOn: null,
    workingWeekdays: weekdays.value,
    skipDates: skips.value,
  };
  const finish = (start: Ymd | null, days: number): Result<ScheduleValue> => {
    const s: Schedule = { ...base, startOn: start };
    return {
      ok: true,
      value: {
        dayCount: days,
        startOn: start,
        endOn: start ? endOn(s, days) : null,
        workingWeekdays: weekdays.value,
        skipDates: skips.value,
      },
    };
  };

  // Start + end dates: the duration is the number of working dates between them
  if (startOn && endIn) {
    if (endIn < startOn) return fail('The end date must be on or after the start date.');
    const startErr = checkStart(startOn, ctx);
    if (startErr) return fail(startErr);
    const s: Schedule = { ...base, startOn: nextWorkingDate(base, startOn) };
    let count = 0;
    for (let d = s.startOn!; d <= endIn; d = addDays(d, 1)) if (isWorkingDate(s, d)) count++;
    if (count < 1) return fail('There are no working days between the start and end dates.');
    if (count > MAX_DAYS) {
      return fail(`That range holds ${count} working days; the maximum is ${MAX_DAYS}.`);
    }
    if (dayCount !== undefined && dayCount !== count) {
      return fail(`The dates cover ${count} working days, not ${dayCount}. Change one of them.`);
    }
    return finish(s.startOn, count);
  }

  if (dayCount === undefined) {
    return fail('Provide a duration (days), or both a start date and an end date.');
  }

  if (startOn) {
    const startErr = checkStart(startOn, ctx);
    if (startErr) return fail(startErr);
    return finish(nextWorkingDate(base, startOn), dayCount);
  }

  if (endIn) {
    // Work backwards from the end date to find the start
    let d = endIn;
    let found = 0;
    for (let i = 0; i < 4000 && found < dayCount; i++, d = addDays(d, -1)) {
      if (isWorkingDate({ ...base, startOn: endIn }, d)) {
        found++;
        if (found === dayCount) break;
      }
    }
    if (found < dayCount) return fail('Could not fit that duration before the end date.');
    const startErr = checkStart(d, ctx);
    if (startErr) return fail(`${startErr} Pick a later end date or a shorter duration.`);
    return finish(d, dayCount);
  }

  return finish(null, dayCount); // duration only: scheduled later
}

// ---------------------------------------------------------------- operations
export interface RunwayState {
  schedule: Schedule;
  dayCount: number;
  /**
   * Days that can no longer move: their date is in the past, or they have progress
   * (a done step or a started day clock). Always a prefix of the plan.
   */
  lockedDays: number;
}

export interface OpResult {
  schedule: Schedule;
  endOn: Ymd | null;
  calendar: { dayIndex: number; date: Ymd | null }[];
}

const done = (s: Schedule, dayCount: number): { ok: true; value: OpResult } => ({
  ok: true,
  value: { schedule: s, endOn: endOn(s, dayCount), calendar: calendar(s, dayCount) },
});

/** Locked days must keep their dates after any change. */
function lockedStable(before: RunwayState, after: Schedule): string | null {
  for (let i = 0; i < before.lockedDays; i++) {
    if (dateForDay(before.schedule, i) !== dateForDay(after, i)) {
      return 'Days that are already past or underway cannot move.';
    }
  }
  return null;
}

const tooFar = (s: Schedule, dayCount: number, ctx: ScheduleCtx): string | null =>
  s.startOn && diffDays(ctx.today, endOn(s, dayCount)!) > MAX_AHEAD_DAYS + MAX_DAYS
    ? 'That would push the plan more than a year ahead.'
    : null;

/** Start now (or on a chosen future date) for an unscheduled runway. */
export function planStart(
  state: RunwayState,
  ctx: ScheduleCtx,
  startOn?: string
): Result<OpResult> {
  if (state.schedule.startOn)
    return fail('This runway already has a start date. Shift it instead.');
  const wanted = startOn ?? ctx.today;
  if (!isYmd(wanted)) return fail('The start date is not a valid date.');
  const err = checkStart(wanted, ctx);
  if (err) return fail(err);
  const schedule = { ...state.schedule, startOn: nextWorkingDate(state.schedule, wanted) };
  return done(schedule, state.dayCount);
}

/** Move the whole runway to a new start date (only while no day is past or underway). */
export function planShift(
  state: RunwayState,
  newStart: string,
  ctx: ScheduleCtx
): Result<OpResult> {
  if (!state.schedule.startOn) return fail('Start the runway first; it has no dates yet.');
  if (!isYmd(newStart)) return fail('The start date is not a valid date.');
  if (state.lockedDays > 0) {
    return fail(
      'Part of this runway is already past or underway. Postpone from a later day instead.'
    );
  }
  const err = checkStart(newStart, ctx);
  if (err) return fail(err);
  const schedule = shiftTo(state.schedule, newStart);
  const far = tooFar(schedule, state.dayCount, ctx);
  return far ? fail(far) : done(schedule, state.dayCount);
}

/** Push `fromDay` (0-based) and everything after it forward by `count` working days. */
export function planPostpone(
  state: RunwayState,
  fromDay: number,
  count: number,
  ctx: ScheduleCtx
): Result<OpResult> {
  if (!state.schedule.startOn) return fail('Start the runway first; it has no dates yet.');
  if (!Number.isInteger(fromDay) || fromDay < 0 || fromDay >= state.dayCount) {
    return fail('That day does not exist.');
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_DAYS) {
    return fail(`Postpone by 1 to ${MAX_DAYS} days.`);
  }
  if (fromDay < state.lockedDays) {
    return fail(`Day ${fromDay + 1} is already past or underway and cannot be postponed.`);
  }
  if (ctx.strict && dateForDay(state.schedule, fromDay)! < ctx.today) {
    return fail("You can't postpone a day that is in the past.");
  }
  const schedule = postponeFrom(state.schedule, fromDay, count);
  if (schedule.skipDates.length > MAX_SKIP_DATES) {
    return fail(`At most ${MAX_SKIP_DATES} skipped dates.`);
  }
  const far = tooFar(schedule, state.dayCount, ctx);
  return far ? fail(far) : done(schedule, state.dayCount);
}

/** Change which weekdays are worked (affects only days that are not locked). */
export function planWorkingDays(
  state: RunwayState,
  weekdays: number[],
  ctx: ScheduleCtx
): Result<OpResult> {
  const w = normalizeWeekdays(weekdays);
  if (!w.ok) return w;
  const schedule = { ...state.schedule, workingWeekdays: w.value };
  if (!schedule.startOn) return done(schedule, state.dayCount);
  // Day 1 may land on a different date if its weekday is no longer worked
  const moved = nextWorkingDate(schedule, schedule.startOn);
  const next = state.lockedDays === 0 ? { ...schedule, startOn: moved } : schedule;
  const locked = lockedStable(state, next);
  if (locked)
    return fail(locked, 'Change working days before the runway starts, or from a later day.');
  if (ctx.strict && next.startOn && next.startOn < ctx.today) {
    return fail('That would move the start into the past.');
  }
  const far = tooFar(next, state.dayCount, ctx);
  return far ? fail(far) : done(next, state.dayCount);
}

/** Add or remove individual rest dates. */
export function planSkipDates(
  state: RunwayState,
  add: string[],
  remove: string[],
  ctx: ScheduleCtx
): Result<OpResult> {
  if (!state.schedule.startOn) return fail('Start the runway first; it has no dates yet.');
  if (![...add, ...remove].every(isYmd)) return fail('Dates must be valid (YYYY-MM-DD).');
  if (ctx.strict && add.some((d) => d < ctx.today))
    return fail("Skipped dates can't be in the past.");
  if (add.some((d) => d < state.schedule.startOn!)) {
    return fail('Skipped dates must be on or after the start date.');
  }
  const skip = new Set(state.schedule.skipDates);
  add.forEach((d) => skip.add(d));
  remove.forEach((d) => skip.delete(d));
  if (skip.size > MAX_SKIP_DATES) return fail(`At most ${MAX_SKIP_DATES} skipped dates.`);
  const schedule = { ...state.schedule, skipDates: Array.from(skip).sort() };
  const locked = lockedStable(state, schedule);
  if (locked) return fail(locked);
  const far = tooFar(schedule, state.dayCount, ctx);
  return far ? fail(far) : done(schedule, state.dayCount);
}

/**
 * Strict mode: a step may not be moved onto (or created on) a day whose date is in the
 * past. Unscheduled runways have no dates, so any day is allowed.
 */
export function dayIsInPast(s: Schedule, dayIndex: number, today: Ymd): boolean {
  const date = dateForDay(s, dayIndex);
  return !!date && date < today;
}

/**
 * Window for a REPLANNED runway (a new version): it starts today, or on the previous start
 * date if that is still ahead; never in the past. The working week carries over and rest
 * dates before the new start are dropped. An unscheduled runway stays unscheduled.
 */
export function replanWindow(prev: Schedule | null, today: Ymd) {
  const startOn: Ymd | undefined = prev?.startOn
    ? prev.startOn > today
      ? prev.startOn
      : today
    : undefined;
  return {
    startOn,
    workingWeekdays: prev?.workingWeekdays,
    skipDates: startOn ? (prev?.skipDates ?? []).filter((d) => d >= startOn) : [],
  };
}
