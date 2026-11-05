'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRunwayAccess } from '@/server/dal/access';
import {
  getRunwayCalendar,
  getScheduleContext,
  postponeRunway,
  setRunwayWorkingDays,
  shiftRunway,
  skipRunwayDates,
  startRunway,
  ScheduleOutcome,
} from '@/server/dal/schedule';
import {
  postponeSchema,
  shiftRunwaySchema,
  skipDatesSchema,
  startRunwaySchema,
  workingDaysSchema,
} from './schemas';

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

function refresh() {
  revalidatePath('/runway');
  revalidatePath('/today');
  revalidatePath('/missions');
}

function fail(error: unknown) {
  const msg = error instanceof Error ? error.message : '';
  const safe = /not found|permission|Unauthorized/i.test(msg);
  return { success: false as const, errors: [safe ? msg : 'Something went wrong'] };
}

function out(res: ScheduleOutcome) {
  if (!res.ok) return { success: false as const, errors: res.errors };
  if (res.applied) refresh();
  return { success: true as const, applied: res.applied, calendar: res.calendar };
}

/** Calendar (dates per day, status, locked days) for any member who can see the runway. */
export async function actionGetCalendar(runwayId: string) {
  try {
    const userId = await getUserId();
    const access = await requireRunwayAccess(userId, runwayId, 'viewer');
    const ctx = await getScheduleContext(userId);
    const calendar = await getRunwayCalendar(access.ownerId, runwayId, ctx);
    return calendar
      ? { success: true as const, calendar }
      : { success: false as const, errors: ['Runway not found'] };
  } catch (e) {
    return fail(e);
  }
}

async function editorContext(runwayId: string) {
  const userId = await getUserId();
  const access = await requireRunwayAccess(userId, runwayId, 'editor');
  return { ownerId: access.ownerId, ctx: await getScheduleContext(userId) };
}

export async function actionStartRunway(raw: unknown) {
  try {
    const p = startRunwaySchema.safeParse(raw);
    if (!p.success) return { success: false as const, errors: ['Invalid request'] };
    const { ownerId, ctx } = await editorContext(p.data.runwayId);
    return out(await startRunway(ownerId, p.data.runwayId, ctx, p.data.startOn, p.data.dryRun));
  } catch (e) {
    return fail(e);
  }
}

export async function actionShiftRunway(raw: unknown) {
  try {
    const p = shiftRunwaySchema.safeParse(raw);
    if (!p.success) return { success: false as const, errors: ['Invalid request'] };
    const { ownerId, ctx } = await editorContext(p.data.runwayId);
    return out(await shiftRunway(ownerId, p.data.runwayId, ctx, p.data.startOn, p.data.dryRun));
  } catch (e) {
    return fail(e);
  }
}

export async function actionPostponeRunway(raw: unknown) {
  try {
    const p = postponeSchema.safeParse(raw);
    if (!p.success) return { success: false as const, errors: ['Invalid request'] };
    const { ownerId, ctx } = await editorContext(p.data.runwayId);
    return out(
      await postponeRunway(
        ownerId,
        p.data.runwayId,
        ctx,
        p.data.fromDay,
        p.data.days,
        p.data.dryRun
      )
    );
  } catch (e) {
    return fail(e);
  }
}

export async function actionSetWorkingDays(raw: unknown) {
  try {
    const p = workingDaysSchema.safeParse(raw);
    if (!p.success) return { success: false as const, errors: ['Invalid request'] };
    const { ownerId, ctx } = await editorContext(p.data.runwayId);
    return out(
      await setRunwayWorkingDays(ownerId, p.data.runwayId, ctx, p.data.weekdays, p.data.dryRun)
    );
  } catch (e) {
    return fail(e);
  }
}

export async function actionSkipDates(raw: unknown) {
  try {
    const p = skipDatesSchema.safeParse(raw);
    if (!p.success) return { success: false as const, errors: ['Invalid request'] };
    const { ownerId, ctx } = await editorContext(p.data.runwayId);
    return out(
      await skipRunwayDates(ownerId, p.data.runwayId, ctx, p.data.add, p.data.remove, p.data.dryRun)
    );
  } catch (e) {
    return fail(e);
  }
}
