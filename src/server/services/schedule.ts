import {
  ScheduleCtx,
  ScheduleInput,
  ScheduleValue,
  Result,
  validateNewSchedule,
  dayIsInPast,
  replanWindow,
} from '@/lib/schedule';
import { dateForDay, dayStateFor, formatDayLabel, Ymd, ymdToDate } from '@/lib/calendar';
import { getRunwayById } from '@/server/dal/runways';
import { getScheduleContext, runwaySchedule } from '@/server/dal/schedule';

/**
 * Validates a schedule for something being CREATED by `actorId`, using that user's
 * timezone, strict mode and default working week.
 */
export async function resolveNewSchedule(
  actorId: string,
  input: ScheduleInput
): Promise<Result<ScheduleValue>> {
  const ctx = await getScheduleContext(actorId);
  return validateNewSchedule(input, ctx);
}

/** The date mirrors stored on missions / runways for a resolved schedule. */
export const scheduleDates = (v: ScheduleValue) => ({
  startDate: v.startOn ? ymdToDate(v.startOn) : undefined,
  deadline: v.endOn ? ymdToDate(v.endOn) : undefined,
});

export const scheduleError = (errors: string[]) => errors.join(' ');

/**
 * Strict mode: tasks cannot be created on, or moved to, a day whose date is in the past.
 * Returns an error message, or null when the move is allowed. Moving within the same day
 * (re-ordering) is always fine.
 */
export async function checkDayNotInPast(
  actorId: string,
  ownerId: string,
  runwayId: string | undefined,
  dayIndex: number,
  currentDayIndex?: number
): Promise<string | null> {
  if (!runwayId || dayIndex === currentDayIndex) return null;
  const ctx = await getScheduleContext(actorId);
  if (!ctx.strict) return null;
  const runway = await getRunwayById(ownerId, runwayId);
  if (!runway) return null;
  const schedule = runwaySchedule(runway, ctx.tz);
  return dayIsInPast(schedule, dayIndex, ctx.today)
    ? "You can't move or add tasks on a day that is in the past. Use a later day, or replan."
    : null;
}

// ------------------------------------------------------------------- replan
interface RunwayForReplan {
  dayCount: number;
  startOn?: string | null;
  startDate?: Date | null;
  workingWeekdays?: number[] | null;
  skipDates?: string[] | null;
}

/**
 * Working days left in the active runway, counting today when today is a working day.
 * Past days are never counted: a replan can only use days that are still ahead.
 */
export function remainingWorkingDays(
  runway: RunwayForReplan | null,
  ctx: ScheduleCtx & { tz: string },
  fallback: number
): number {
  if (!runway) return fallback;
  const schedule = runwaySchedule(runway, ctx.tz);
  const st = dayStateFor(schedule, runway.dayCount, ctx.today);
  switch (st.state) {
    case 'unscheduled':
    case 'upcoming':
      return runway.dayCount;
    case 'working':
      return runway.dayCount - st.dayIndex;
    case 'rest':
      return st.nextDayIndex === null ? 0 : runway.dayCount - st.nextDayIndex;
    case 'ended':
      return 0;
  }
}

/**
 * Schedule for the replanned runway (a NEW version): it starts today (or its original
 * start date if that is still ahead), never in the past, and keeps the working week.
 * An unscheduled runway stays unscheduled.
 */
export async function replanSchedule(
  actorId: string,
  previous: RunwayForReplan | null,
  dayCount: number
): Promise<Result<ScheduleValue>> {
  const ctx = await getScheduleContext(actorId);
  const prev = previous ? runwaySchedule(previous, ctx.tz) : null;
  return validateNewSchedule({ dayCount, ...replanWindow(prev, ctx.today) }, ctx);
}

/** The 24h day clock only runs on scheduled days, and never before the day's own date. */
export async function checkDayStartable(
  actorId: string,
  ownerId: string,
  runwayId: string,
  dayIndex: number
): Promise<string | null> {
  const [runway, ctx] = await Promise.all([
    getRunwayById(ownerId, runwayId),
    getScheduleContext(actorId),
  ]);
  if (!runway) return 'Runway not found';
  const schedule = runwaySchedule(runway, ctx.tz);
  if (!schedule.startOn) return 'Start the runway first. It has no dates yet.';
  const date = dateForDay(schedule, dayIndex);
  if (date && date > ctx.today) {
    return `Day ${dayIndex + 1} starts on ${formatDayLabel(date)}. You can't start it early.`;
  }
  return null;
}
