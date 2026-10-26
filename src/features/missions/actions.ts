'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import {
  createMission,
  updateMission,
  deleteMission,
  archiveMission,
  getMissions,
  getMissionById,
} from '@/server/dal/missions';
import {
  createStep,
  updateStep,
  reorderStep,
  deleteStep,
  getStepsByMission,
  getAllSteps,
  rolloverSteps,
} from '@/server/dal/steps';
import { getRunwaysByMission, getAllRunways, getRunwayById } from '@/server/dal/runways';
import { getInsightsData } from '@/server/dal/insights';
import {
  startTimeLog,
  stopTimeLog,
  getTimeLogsByStep,
  getTimeLogById,
} from '@/server/dal/timeLogs';
import { requireMissionAccess, requireStepAccess } from '@/server/dal/access';
import { getMemberCounts, getSharedMissions, listMembers } from '@/server/dal/members';
import {
  createMissionSchema,
  updateMissionSchema,
  createStepSchema,
  updateStepSchema,
  reorderStepSchema,
  rolloverSchema,
  CreateMissionInput,
  UpdateMissionInput,
  CreateStepInput,
  UpdateStepInput,
} from './schemas';

async function getRequiredUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

function revalidateAll() {
  revalidatePath('/missions');
  revalidatePath('/runway');
  revalidatePath('/today');
  revalidatePath('/insights');
}

// ---------------- Mission Actions ----------------

export async function actionCreateMission(raw: CreateMissionInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = createMissionSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const mission = await createMission(userId, parsed.data);
    revalidateAll();
    return { success: true, data: JSON.parse(JSON.stringify(mission)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionUpdateMission(missionId: string, raw: UpdateMissionInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = updateMissionSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const access = await requireMissionAccess(userId, missionId, 'editor');
    // Archiving is an owner-only lifecycle action
    if (
      access.role !== 'owner' &&
      (parsed.data.archived !== undefined || parsed.data.status === 'archived')
    ) {
      return { success: false, error: 'Only the owner can archive a mission' };
    }

    const updated = await updateMission(access.ownerId, missionId, parsed.data);
    revalidateAll();
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionDeleteMission(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    await requireMissionAccess(userId, missionId, 'owner');
    await deleteMission(userId, missionId);
    revalidateAll();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionArchiveMission(missionId: string, archived: boolean) {
  try {
    const userId = await getRequiredUserId();
    await requireMissionAccess(userId, missionId, 'owner');
    await archiveMission(userId, missionId, archived);
    revalidateAll();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionGetMissions() {
  try {
    const userId = await getRequiredUserId();
    await connectDB();
    const [missions, runways, steps, memberCounts, shared] = await Promise.all([
      getMissions(userId),
      getAllRunways(userId),
      getAllSteps(userId),
      getMemberCounts(userId),
      getSharedMissions(userId),
    ]);

    const owned = missions.map((m) => {
      const mId = m._id.toString();
      const mRunways = runways.filter((r) => r.missionId.toString() === mId);
      const mSteps = steps.filter((s) => s.missionId.toString() === mId);
      const mCompleted = mSteps.filter((s) => s.status === 'done');
      return {
        ...m,
        role: 'owner' as const,
        memberCount: memberCounts.get(mId) || 0,
        runwayCount: mRunways.length,
        hasRunway: mRunways.length > 0,
        stepCount: mSteps.length,
        completedStepCount: mCompleted.length,
      };
    });

    const sharedWithMe = shared.map((s) => ({
      ...s.mission,
      role: s.role,
      ownerName: s.ownerName,
      ownerEmail: s.ownerEmail,
      runwayCount: s.runwayCount,
      hasRunway: s.runwayCount > 0,
      stepCount: s.stepCount,
      completedStepCount: s.completedStepCount,
    }));

    // Never leak the owner's internal userId to collaborators
    const sanitized = [...owned, ...sharedWithMe].map((m) => {
      const { userId: _omit, ...rest } = m as Record<string, unknown>;
      void _omit;
      return rest;
    });

    return { success: true, data: JSON.parse(JSON.stringify(sanitized)) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Server error',
      data: [],
    };
  }
}

export async function actionGetMissionDetails(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    const access = await requireMissionAccess(userId, missionId, 'viewer');
    const ownerId = access.ownerId;

    const [mission, runways, steps, insights, members] = await Promise.all([
      getMissionById(ownerId, missionId),
      getRunwaysByMission(ownerId, missionId),
      getStepsByMission(ownerId, missionId),
      getInsightsData(ownerId, missionId),
      listMembers(ownerId, missionId),
    ]);

    if (!mission) {
      return { success: false, error: 'Mission not found' };
    }

    const { userId: _omit, ...publicMission } = mission as unknown as Record<string, unknown>;
    void _omit;

    return {
      success: true,
      data: {
        mission: JSON.parse(JSON.stringify(publicMission)),
        runways: JSON.parse(JSON.stringify(runways)),
        steps: JSON.parse(JSON.stringify(steps)),
        insights: JSON.parse(JSON.stringify(insights)),
        members: JSON.parse(JSON.stringify(members)),
        role: access.role,
        currentUserId: userId,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

// ---------------- Step Actions ----------------

export async function actionCreateStep(raw: CreateStepInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = createStepSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const access = await requireMissionAccess(userId, parsed.data.missionId, 'editor');

    // A runway reference must belong to this very mission
    if (parsed.data.runwayId) {
      const runway = await getRunwayById(access.ownerId, parsed.data.runwayId);
      if (!runway || runway.missionId.toString() !== parsed.data.missionId) {
        return { success: false, error: 'Runway not found' };
      }
    }

    const step = await createStep(access.ownerId, parsed.data);
    revalidatePath('/runway');
    revalidatePath('/today');
    revalidatePath('/missions');
    revalidatePath('/insights');
    return { success: true, data: JSON.parse(JSON.stringify(step)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionUpdateStep(stepId: string, raw: UpdateStepInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = updateStepSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const access = await requireStepAccess(userId, stepId, 'editor');
    // runwayId is not updatable (prevents re-parenting a step into another tree)
    const { runwayId: _ignored, ...changes } = parsed.data;
    void _ignored;

    const updated = await updateStep(access.ownerId, stepId, changes);
    revalidatePath('/runway');
    revalidatePath('/today');
    revalidatePath('/missions');
    revalidatePath('/insights');
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionReorderStep(raw: {
  stepId: string;
  newDayIndex: number;
  newOrder: string;
}) {
  try {
    const userId = await getRequiredUserId();
    const parsed = reorderStepSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Invalid reorder parameters' };
    }

    const access = await requireStepAccess(userId, parsed.data.stepId, 'editor');
    const updated = await reorderStep(
      access.ownerId,
      parsed.data.stepId,
      parsed.data.newDayIndex,
      parsed.data.newOrder
    );
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionQuickUpdateStepStatus(
  stepId: string,
  status: 'todo' | 'doing' | 'done' | 'blocked' | 'skipped'
) {
  try {
    const userId = await getRequiredUserId();
    const parsed = updateStepSchema.shape.status.safeParse(status);
    if (!parsed.success) return { success: false, error: 'Invalid status' };

    const access = await requireStepAccess(userId, stepId, 'editor');
    await updateStep(access.ownerId, stepId, { status });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionQuickReorderStep(raw: {
  stepId: string;
  newDayIndex: number;
  newOrder: string;
}) {
  try {
    const userId = await getRequiredUserId();
    const parsed = reorderStepSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Invalid reorder parameters' };
    }

    const access = await requireStepAccess(userId, parsed.data.stepId, 'editor');
    await reorderStep(
      access.ownerId,
      parsed.data.stepId,
      parsed.data.newDayIndex,
      parsed.data.newOrder
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionDeleteStep(stepId: string) {
  try {
    const userId = await getRequiredUserId();
    const access = await requireStepAccess(userId, stepId, 'editor');
    await deleteStep(access.ownerId, stepId);
    revalidatePath('/runway');
    revalidatePath('/today');
    revalidatePath('/missions');
    revalidatePath('/insights');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionRolloverSteps(raw: {
  missionId: string;
  moves: { id: string; toDay: number }[];
}) {
  try {
    const userId = await getRequiredUserId();
    const parsed = rolloverSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'Invalid rollover request' };
    }

    const access = await requireMissionAccess(userId, parsed.data.missionId, 'editor');
    const res = await rolloverSteps(access.ownerId, parsed.data.missionId, parsed.data.moves);
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true, count: res.count };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

// ---------------- Timer & TimeLog Actions ----------------

export async function actionStartTimeLog(stepId: string) {
  try {
    const userId = await getRequiredUserId();
    const access = await requireStepAccess(userId, stepId, 'editor');
    // The time log belongs to the person who worked; mission is derived server-side
    const log = await startTimeLog(userId, stepId, access.stepMissionId);
    return { success: true, data: JSON.parse(JSON.stringify(log)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionStopTimeLog(logId: string, durationSec: number) {
  try {
    const userId = await getRequiredUserId();
    const safeDuration = Math.min(Math.max(0, Math.floor(Number(durationSec) || 0)), 24 * 3600);

    const log = await getTimeLogById(userId, logId);
    if (!log) return { success: false, error: 'Time log not found' };

    // Access may have been revoked since the timer started
    const access = await requireStepAccess(userId, log.stepId.toString(), 'editor');
    const stopped = await stopTimeLog(userId, logId, safeDuration, access.ownerId);
    revalidatePath('/runway');
    revalidatePath('/today');
    revalidatePath('/insights');
    return { success: true, data: JSON.parse(JSON.stringify(stopped)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionGetStepTimeLogs(stepId: string) {
  try {
    const userId = await getRequiredUserId();
    await requireStepAccess(userId, stepId, 'viewer');
    const logs = await getTimeLogsByStep(userId, stepId);
    return { success: true, data: JSON.parse(JSON.stringify(logs)) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Server error',
      data: [],
    };
  }
}
