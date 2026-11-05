import { describe, it, expect } from 'vitest';
import {
  ALL_WEEKDAYS,
  Schedule,
  calendar,
  clampedDayIndex,
  dateForDay,
  dayStateFor,
  endOn,
  nextWorkingDate,
  postponeFrom,
  shiftTo,
  weekdayOf,
} from '@/lib/calendar';
import {
  RunwayState,
  dayIsInPast,
  planPostpone,
  planShift,
  planSkipDates,
  planStart,
  planWorkingDays,
  replanWindow,
  validateNewSchedule,
} from '@/lib/schedule';

// 2026-11-09 is a Monday
const sched = (over: Partial<Schedule> = {}): Schedule => ({
  startOn: '2026-11-09',
  workingWeekdays: ALL_WEEKDAYS,
  skipDates: [],
  ...over,
});
const WEEK = [1, 2, 3, 4, 5];
const ctx = { today: '2026-11-09', strict: true };

describe('calendar math', () => {
  it('knows the weekday of a date', () => {
    expect(weekdayOf('2026-11-09')).toBe(1);
  });

  it('counts every day when all weekdays are worked', () => {
    expect(calendar(sched(), 3).map((d) => d.date)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });

  it('skips non-working weekdays', () => {
    const s = sched({ startOn: '2026-11-13', workingWeekdays: WEEK }); // Friday
    expect(dateForDay(s, 0)).toBe('2026-11-13');
    expect(dateForDay(s, 1)).toBe('2026-11-16'); // next Monday
    expect(endOn(s, 6)).toBe('2026-11-20');
  });

  it('skipped dates push later days forward but keep day numbers', () => {
    const s = sched({ skipDates: ['2026-11-11'] });
    expect(calendar(s, 4).map((d) => d.date)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-12',
      '2026-11-13',
    ]);
  });

  it('is unscheduled without a start date', () => {
    expect(dateForDay(sched({ startOn: null }), 0)).toBeNull();
    expect(dayStateFor(sched({ startOn: null }), 3, '2026-11-09').state).toBe('unscheduled');
  });

  it('reports where today falls', () => {
    const s = sched({ workingWeekdays: WEEK });
    expect(dayStateFor(s, 5, '2026-11-02')).toMatchObject({ state: 'upcoming', daysUntil: 7 });
    expect(dayStateFor(s, 5, '2026-11-11')).toEqual({ state: 'working', dayIndex: 2 });
    // Saturday after Friday's day 5 (index 4) with 7 days => rest, next is day index 5 on Monday
    expect(dayStateFor(s, 7, '2026-11-14')).toEqual({
      state: 'rest',
      nextDayIndex: 5,
      nextDate: '2026-11-16',
    });
    expect(dayStateFor(s, 5, '2026-11-30')).toMatchObject({
      state: 'ended',
      endedOn: '2026-11-13',
    });
    expect(clampedDayIndex(s, 5, '2026-11-30')).toBe(4);
    expect(clampedDayIndex(s, 5, '2026-11-01')).toBe(0);
  });

  it('moves the start to the next working date', () => {
    expect(nextWorkingDate(sched({ workingWeekdays: WEEK }), '2026-11-14')).toBe('2026-11-16');
    expect(() => nextWorkingDate(sched({ workingWeekdays: [] }), '2026-11-14')).toThrow();
  });

  it('shifts the whole plan, taking rest dates with it', () => {
    const s = shiftTo(sched({ skipDates: ['2026-11-11'] }), '2026-11-16');
    expect(s.startOn).toBe('2026-11-16');
    expect(s.skipDates).toEqual(['2026-11-18']);
  });

  it('postpones from a day by adding rest dates', () => {
    const s = postponeFrom(sched({ startOn: '2026-11-10' }), 2, 2); // day 3 was 11-12
    expect(s.skipDates).toEqual(['2026-11-12', '2026-11-13']);
    expect(dateForDay(s, 1)).toBe('2026-11-11');
    expect(dateForDay(s, 2)).toBe('2026-11-14');
  });
});

describe('creating a schedule', () => {
  it('needs a duration, or a start and an end date', () => {
    expect(validateNewSchedule({}, ctx).ok).toBe(false);
    expect(validateNewSchedule({ startOn: '2026-11-10' }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ endOn: '2026-11-20' }, ctx).ok).toBe(false);
  });

  it('accepts a duration only and leaves it unscheduled', () => {
    const r = validateNewSchedule({ dayCount: 11 }, ctx);
    expect(r).toMatchObject({ ok: true, value: { dayCount: 11, startOn: null, endOn: null } });
  });

  it('derives the end date from duration + start', () => {
    const r = validateNewSchedule({ dayCount: 5, startOn: '2026-11-12' }, ctx);
    expect(r).toMatchObject({ ok: true, value: { startOn: '2026-11-12', endOn: '2026-11-16' } });
  });

  it('derives the duration from start + end', () => {
    const r = validateNewSchedule({ startOn: '2026-11-10', endOn: '2026-11-20' }, ctx);
    expect(r).toMatchObject({ ok: true, value: { dayCount: 11 } });
    const weekdays = validateNewSchedule(
      { startOn: '2026-11-10', endOn: '2026-11-20', workingWeekdays: WEEK },
      ctx
    );
    expect(weekdays).toMatchObject({ ok: true, value: { dayCount: 9 } });
  });

  it('derives the start from duration + end', () => {
    const r = validateNewSchedule({ dayCount: 3, endOn: '2026-11-20' }, ctx);
    expect(r).toMatchObject({ ok: true, value: { startOn: '2026-11-18', endOn: '2026-11-20' } });
  });

  it('rejects past dates in strict mode and allows them when relaxed', () => {
    const past = { dayCount: 3, startOn: '2026-11-01' };
    expect(validateNewSchedule(past, ctx).ok).toBe(false);
    expect(validateNewSchedule(past, { ...ctx, strict: false }).ok).toBe(true);
    expect(validateNewSchedule({ dayCount: 3, endOn: '2026-11-10' }, ctx).ok).toBe(false);
  });

  it('rejects impossible or inconsistent input', () => {
    expect(validateNewSchedule({ startOn: '2026-11-20', endOn: '2026-11-10' }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 31 }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 0 }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 3, startOn: '2028-01-01' }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 3, startOn: '2026-13-45' }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 3, workingWeekdays: [] }, ctx).ok).toBe(false);
    expect(validateNewSchedule({ dayCount: 3, workingWeekdays: [9] }, ctx).ok).toBe(false);
    expect(
      validateNewSchedule({ dayCount: 4, startOn: '2026-11-10', endOn: '2026-11-20' }, ctx).ok
    ).toBe(false);
  });

  it('moves a start that lands on a rest weekday', () => {
    const r = validateNewSchedule(
      { dayCount: 3, startOn: '2026-11-14', workingWeekdays: WEEK },
      ctx
    );
    expect(r).toMatchObject({ ok: true, value: { startOn: '2026-11-16' } });
  });
});

describe('changing a running plan', () => {
  const state = (over: Partial<RunwayState> = {}): RunwayState => ({
    schedule: sched({ startOn: '2026-11-10' }),
    dayCount: 7,
    lockedDays: 0,
    ...over,
  });

  it('starts an unscheduled runway today or on a future date, never in the past', () => {
    const base = state({ schedule: sched({ startOn: null }) });
    expect(planStart(base, ctx)).toMatchObject({
      ok: true,
      value: { schedule: { startOn: '2026-11-09' } },
    });
    expect(planStart(base, ctx, '2026-11-20')).toMatchObject({ ok: true });
    expect(planStart(base, ctx, '2026-11-01').ok).toBe(false);
    expect(planStart(state(), ctx).ok).toBe(false); // already has dates
  });

  it('shifts the whole runway only before any day is past or underway', () => {
    const ok = planShift(state(), '2026-11-17', ctx);
    expect(ok).toMatchObject({ ok: true, value: { endOn: '2026-11-23' } });
    expect(planShift(state({ lockedDays: 2 }), '2026-11-17', ctx).ok).toBe(false);
    expect(planShift(state(), '2026-11-01', ctx).ok).toBe(false);
  });

  it('postpones from a later day and protects locked days', () => {
    const ok = planPostpone(state({ lockedDays: 2 }), 3, 2, ctx);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.calendar[1].date).toBe('2026-11-11'); // locked day unchanged
      expect(ok.value.calendar[3].date).toBe('2026-11-15'); // pushed by 2
    }
    expect(planPostpone(state({ lockedDays: 2 }), 1, 2, ctx).ok).toBe(false);
    expect(planPostpone(state(), 9, 1, ctx).ok).toBe(false);
    expect(planPostpone(state(), 2, 0, ctx).ok).toBe(false);
  });

  it('lets working weekdays change without moving locked days', () => {
    // Remove Wednesdays (3). Locked days 0..1 (Tue 10, Wed 11) => Wed would move, so it is refused
    expect(planWorkingDays(state({ lockedDays: 2 }), [0, 1, 2, 4, 5, 6], ctx).ok).toBe(false);
    // Removing Saturday (6) later in the plan does not touch locked days
    expect(planWorkingDays(state({ lockedDays: 2 }), [0, 1, 2, 3, 4, 5], ctx).ok).toBe(true);
    expect(planWorkingDays(state(), [], ctx).ok).toBe(false);
  });

  it('adds and removes single rest dates', () => {
    const r = planSkipDates(state(), ['2026-11-13'], [], ctx);
    expect(r.ok).toBe(true);
    expect(planSkipDates(state(), ['2026-11-01'], [], ctx).ok).toBe(false);
    expect(planSkipDates(state({ lockedDays: 3 }), ['2026-11-11'], [], ctx).ok).toBe(false);
  });

  it('flags past days so tasks cannot be moved onto them', () => {
    const s = sched({ startOn: '2026-11-01' });
    expect(dayIsInPast(s, 3, '2026-11-09')).toBe(true);
    expect(dayIsInPast(s, 9, '2026-11-09')).toBe(false);
    expect(dayIsInPast(sched({ startOn: null }), 0, '2026-11-09')).toBe(false);
  });
});

describe('replan window', () => {
  it('starts today when the old start is in the past, keeping the working week', () => {
    const prev = sched({
      startOn: '2026-11-02',
      workingWeekdays: WEEK,
      skipDates: ['2026-11-04', '2026-11-12'],
    });
    const w = replanWindow(prev, '2026-11-09');
    expect(w.startOn).toBe('2026-11-09');
    expect(w.workingWeekdays).toEqual(WEEK);
    expect(w.skipDates).toEqual(['2026-11-12']); // earlier rest dates are history
    expect(validateNewSchedule({ dayCount: 4, ...w }, ctx).ok).toBe(true);
  });

  it('keeps a future start and never goes into the past', () => {
    expect(replanWindow(sched({ startOn: '2026-11-16' }), '2026-11-09').startOn).toBe('2026-11-16');
  });

  it('leaves an unscheduled runway unscheduled', () => {
    const w = replanWindow(sched({ startOn: null }), '2026-11-09');
    expect(w.startOn).toBeUndefined();
    expect(w.skipDates).toEqual([]);
    expect(replanWindow(null, '2026-11-09').startOn).toBeUndefined();
  });
});
