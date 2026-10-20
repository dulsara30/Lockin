'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
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
  rolloverSteps,
} from '@/server/dal/steps';
import { startTimeLog, stopTimeLog, getTimeLogsByStep } from '@/server/dal/timeLogs';
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

// ---------------- Mission Actions ----------------

export async function actionCreateMission(raw: CreateMissionInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = createMissionSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const mission = await createMission(userId, parsed.data);
    revalidatePath('/missions');
    revalidatePath('/runway');
    revalidatePath('/today');
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

    const updated = await updateMission(userId, missionId, parsed.data);
    revalidatePath('/missions');
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionDeleteMission(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    await deleteMission(userId, missionId);
    revalidatePath('/missions');
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionArchiveMission(missionId: string, archived: boolean) {
  try {
    const userId = await getRequiredUserId();
    await archiveMission(userId, missionId, archived);
    revalidatePath('/missions');
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionGetMissions() {
  try {
    const userId = await getRequiredUserId();
    const missions = await getMissions(userId);
    return { success: true, data: JSON.parse(JSON.stringify(missions)) };
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
    const [mission, steps] = await Promise.all([
      getMissionById(userId, missionId),
      getStepsByMission(userId, missionId),
    ]);
    if (!mission) {
      return { success: false, error: 'Mission not found' };
    }
    return {
      success: true,
      data: {
        mission: JSON.parse(JSON.stringify(mission)),
        steps: JSON.parse(JSON.stringify(steps)),
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

    const step = await createStep(userId, parsed.data);
    revalidatePath('/runway');
    revalidatePath('/today');
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

    const updated = await updateStep(userId, stepId, parsed.data);
    revalidatePath('/runway');
    revalidatePath('/today');
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

    const updated = await reorderStep(
      userId,
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

export async function actionDeleteStep(stepId: string) {
  try {
    const userId = await getRequiredUserId();
    await deleteStep(userId, stepId);
    revalidatePath('/runway');
    revalidatePath('/today');
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

    const res = await rolloverSteps(userId, parsed.data.missionId, parsed.data.moves);
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true, count: res.count };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

// ---------------- Timer & TimeLog Actions ----------------

export async function actionStartTimeLog(stepId: string, missionId?: string) {
  try {
    const userId = await getRequiredUserId();
    const log = await startTimeLog(userId, stepId, missionId);
    return { success: true, data: JSON.parse(JSON.stringify(log)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionStopTimeLog(logId: string, durationSec: number) {
  try {
    const userId = await getRequiredUserId();
    const log = await stopTimeLog(userId, logId, durationSec);
    revalidatePath('/runway');
    revalidatePath('/today');
    return { success: true, data: JSON.parse(JSON.stringify(log)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionGetStepTimeLogs(stepId: string) {
  try {
    const userId = await getRequiredUserId();
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
