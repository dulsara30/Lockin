'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import {
  createRunway,
  getRunwaysByMission,
  getRunwayById,
  updateRunway,
  deleteRunway,
  getAllRunways,
} from '@/server/dal/runways';
import { z } from 'zod';

const createRunwaySchema = z.object({
  missionId: z.string().min(1, 'Mission is required. A runway cannot exist without a mission.'),
  title: z.string().min(1, 'Runway title is required').max(120),
  description: z.string().max(2000).optional(),
  dayCount: z.number().int().min(1).max(30).default(5),
});

async function getRequiredUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export async function actionCreateRunway(raw: unknown) {
  try {
    const userId = await getRequiredUserId();
    const parsed = createRunwaySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const startDate = new Date();
    const deadline = new Date(startDate.getTime() + parsed.data.dayCount * 24 * 60 * 60 * 1000);

    const runway = await createRunway(userId, {
      ...parsed.data,
      startDate,
      deadline,
    });

    revalidatePath('/runway');
    revalidatePath('/missions');
    revalidatePath('/today');

    return { success: true, data: JSON.parse(JSON.stringify(runway)) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}

export async function actionGetRunwaysByMission(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    const runways = await getRunwaysByMission(userId, missionId);
    return { success: true, data: JSON.parse(JSON.stringify(runways)) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Server error',
      data: [],
    };
  }
}

export async function actionDeleteRunway(runwayId: string) {
  try {
    const userId = await getRequiredUserId();
    await deleteRunway(userId, runwayId);
    revalidatePath('/runway');
    revalidatePath('/missions');
    revalidatePath('/today');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server error' };
  }
}
