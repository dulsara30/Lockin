import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Runway } from '@/server/models/Runway';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';
import { getUserSettings } from '@/server/dal/settings';
import {
  ALL_WEEKDAYS,
  DayState,
  Schedule,
  Ymd,
  dateForDay,
  dayStateFor,
  endOn as scheduleEndOn,
  todayInTz,
  ymdInTz,
  ymdToDate,
} from '@/lib/calendar';
import {
  OpResult,
  Result,
  RunwayState,
  ScheduleCtx,
  planPostpone,
  planShift,
  planSkipDates,
  planStart,
  planWorkingDays,
} from '@/lib/schedule';

export interface ScheduleContext extends ScheduleCtx {
  tz: string;
}

/** Calendar settings of the ACTING user (timezone, strict mode, default working week). */
export async function getScheduleContext(
  actorId: string,
  now = new Date()
): Promise<ScheduleContext> {
  const s = await getUserSettings(actorId);
  return {
    tz: s.timezone,
    today: todayInTz(s.timezone, now),
    strict: s.strictSchedule,
    defaultWeekdays: s.workingWeekdays,
  };
}

interface RunwayLike {
  startOn?: string | null;
  startDate?: Date | null;
  workingWeekdays?: number[] | null;
  skipDates?: string[] | null;
}

/** Effective schedule of a runway. Legacy runways (no startOn) derive it from startDate. */
export function runwaySchedule(r: RunwayLike, tz: string): Schedule {
  return {
    startOn: r.startOn ?? (r.startDate ? ymdInTz(r.startDate, tz) : null),
    workingWeekdays: r.workingWeekdays?.length ? r.workingWeekdays : ALL_WEEKDAYS,
    skipDates: r.skipDates ?? [],
  };
}

export type ScheduleRunwayStatus = 'unscheduled' | 'upcoming' | 'running' | 'ended';

export function scheduleStatus(state: DayState): ScheduleRunwayStatus {
  switch (state.state) {
    case 'unscheduled':
      return 'unscheduled';
    case 'upcoming':
      return 'upcoming';
    case 'ended':
      return 'ended';
    default:
      return 'running';
  }
}

/** Days that can no longer move: past (strict mode) or with progress. Always a prefix. */
export function computeLockedDays(
  schedule: Schedule,
  dayCount: number,
  steps: { dayIndex: number; status: string }[],
  startedDays: number[],
  ctx: ScheduleCtx
): number {
  let locked = 0;
  for (let i = 0; i < dayCount; i++) {
    const date = schedule.startOn ? dateForDay(schedule, i) : null;
    const past = ctx.strict && !!date && date < ctx.today;
    const progress =
      startedDays.includes(i) ||
      steps.some((s) => s.dayIndex === i && (s.status === 'done' || s.status === 'doing'));
    if (past || progress) locked = i + 1;
  }
  return locked;
}

function startedDayIndexes(r: { dayStartTimes?: unknown }): number[] {
  const raw = r.dayStartTimes;
  const obj =
    raw instanceof Map ? Object.fromEntries(raw) : ((raw as Record<string, unknown>) ?? {});
  return Object.keys(obj)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isInteger(n));
}

async function loadRunway(ownerId: string, runwayId: string) {
  if (!ownerId) throw new Error('Security Error: userId is required');
  if (!mongoose.isValidObjectId(runwayId)) return null;
  await connectDB();
  return await Runway.findOne({ _id: runwayId, userId: ownerId }).lean().exec();
}

async function loadState(ownerId: string, runwayId: string, ctx: ScheduleContext) {
  const runway = await loadRunway(ownerId, runwayId);
  if (!runway) return null;
  const steps = await Step.find({ userId: ownerId, runwayId }).select('dayIndex status').lean();
  const schedule = runwaySchedule(runway, ctx.tz);
  const state: RunwayState = {
    schedule,
    dayCount: runway.dayCount,
    lockedDays: computeLockedDays(schedule, runway.dayCount, steps, startedDayIndexes(runway), ctx),
  };
  return { runway, state };
}

export interface CalendarView {
  runwayId: string;
  dayCount: number;
  startOn: Ymd | null;
  endOn: Ymd | null;
  workingWeekdays: number[];
  skipDates: Ymd[];
  status: ScheduleRunwayStatus;
  today: DayState;
  /** Today's date (YYYY-MM-DD) in the user's timezone */
  todayDate: Ymd;
  lockedDays: number;
  timezone: string;
  strict: boolean;
  days: { dayIndex: number; date: Ymd | null; locked: boolean }[];
}

function viewOf(
  runwayId: string,
  state: RunwayState,
  schedule: Schedule,
  ctx: ScheduleContext
): CalendarView {
  const today = dayStateFor(schedule, state.dayCount, ctx.today);
  return {
    runwayId,
    dayCount: state.dayCount,
    startOn: schedule.startOn,
    endOn: scheduleEndOn(schedule, state.dayCount),
    workingWeekdays: schedule.workingWeekdays,
    skipDates: schedule.skipDates,
    status: scheduleStatus(today),
    today,
    todayDate: ctx.today,
    lockedDays: state.lockedDays,
    timezone: ctx.tz,
    strict: ctx.strict,
    days: Array.from({ length: state.dayCount }, (_, i) => ({
      dayIndex: i,
      date: schedule.startOn ? dateForDay(schedule, i) : null,
      locked: i < state.lockedDays,
    })),
  };
}

export async function getRunwayCalendar(
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext
): Promise<CalendarView | null> {
  const loaded = await loadState(ownerId, runwayId, ctx);
  return loaded ? viewOf(runwayId, loaded.state, loaded.state.schedule, ctx) : null;
}

async function persist(
  ownerId: string,
  runway: { _id: mongoose.Types.ObjectId; missionId: mongoose.Types.ObjectId; isActive: boolean },
  state: RunwayState,
  result: OpResult,
  action: string,
  meta: Record<string, unknown>
) {
  const s = result.schedule;
  const start = s.startOn ? ymdToDate(s.startOn) : null;
  const end = result.endOn ? ymdToDate(result.endOn) : null;

  await Runway.updateOne(
    { _id: runway._id, userId: ownerId },
    {
      $set: {
        workingWeekdays: s.workingWeekdays,
        skipDates: s.skipDates,
        ...(s.startOn ? { startOn: s.startOn } : {}),
        ...(start ? { startDate: start } : {}),
        ...(end ? { deadline: end } : {}),
      },
      ...(s.startOn ? {} : { $unset: { startOn: '', startDate: '', deadline: '' } }),
    }
  );

  if (runway.isActive) {
    await Mission.updateOne(
      { _id: runway.missionId, userId: ownerId },
      start && end
        ? { $set: { startDate: start, deadline: end, dayCount: state.dayCount } }
        : { $set: { dayCount: state.dayCount }, $unset: { startDate: '', deadline: '' } }
    );
  }

  await Activity.create({
    userId: ownerId,
    type: 'schedule_changed',
    missionId: runway.missionId,
    metadata: {
      action,
      runwayId: runway._id.toString(),
      startOn: s.startOn,
      endOn: result.endOn,
      ...meta,
    },
    at: new Date(),
  });
}

export type ScheduleOutcome =
  { ok: true; calendar: CalendarView; applied: boolean } | { ok: false; errors: string[] };

async function run(
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  action: string,
  meta: Record<string, unknown>,
  plan: (state: RunwayState) => Result<OpResult>,
  dryRun: boolean
): Promise<ScheduleOutcome> {
  const loaded = await loadState(ownerId, runwayId, ctx);
  if (!loaded) return { ok: false, errors: ['Runway not found'] };
  const planned = plan(loaded.state);
  if (!planned.ok) return planned;
  if (!dryRun) await persist(ownerId, loaded.runway, loaded.state, planned.value, action, meta);
  return {
    ok: true,
    applied: !dryRun,
    calendar: viewOf(runwayId, loaded.state, planned.value.schedule, ctx),
  };
}

export const startRunway = (
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  startOn?: string,
  dryRun = false
) => run(ownerId, runwayId, ctx, 'start', {}, (s) => planStart(s, ctx, startOn), dryRun);

export const shiftRunway = (
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  newStart: string,
  dryRun = false
) =>
  run(
    ownerId,
    runwayId,
    ctx,
    'shift',
    { to: newStart },
    (s) => planShift(s, newStart, ctx),
    dryRun
  );

export const postponeRunway = (
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  fromDay: number,
  count: number,
  dryRun = false
) =>
  run(
    ownerId,
    runwayId,
    ctx,
    'postpone',
    { fromDay, count },
    (s) => planPostpone(s, fromDay, count, ctx),
    dryRun
  );

export const setRunwayWorkingDays = (
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  weekdays: number[],
  dryRun = false
) =>
  run(
    ownerId,
    runwayId,
    ctx,
    'working_days',
    { weekdays },
    (s) => planWorkingDays(s, weekdays, ctx),
    dryRun
  );

export const skipRunwayDates = (
  ownerId: string,
  runwayId: string,
  ctx: ScheduleContext,
  add: string[],
  remove: string[],
  dryRun = false
) =>
  run(
    ownerId,
    runwayId,
    ctx,
    'skip_dates',
    { add, remove },
    (s) => planSkipDates(s, add, remove, ctx),
    dryRun
  );
