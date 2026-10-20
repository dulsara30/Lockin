'use server';

import { auth } from '@/lib/auth';
import {
  generatePlanWithGemini,
  replanMissionWithGemini,
  generateDailyBriefWithGemini,
} from '@/lib/ai/gemini';
import {
  parseMarkdownTemplate,
  parseChecklistToPlan,
  parseJsonTemplate,
  ParsedPlan,
} from '@/lib/templates/parser';
import { brainDumpAiInputSchema, templateImportSchema, confirmPlanSchema } from './schemas';
import { createMission, getMissionById, updateMission } from '@/server/dal/missions';
import { createRunway } from '@/server/dal/runways';
import { createStep, getStepsByMission } from '@/server/dal/steps';
import { getTodayDashboardData } from '@/server/dal/today';
import { generateKeyBetween } from 'fractional-indexing';
import { revalidatePath } from 'next/cache';

export async function generatePlanFromAiAction(formData: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const parsed = brainDumpAiInputSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid input data.',
    };
  }

  try {
    const plan = await generatePlanWithGemini({
      userId: session.user.id,
      prompt: parsed.data.prompt,
      days: parsed.data.days,
      hoursPerDay: parsed.data.hoursPerDay,
      priority: parsed.data.priority,
    });

    return { success: true, plan };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    return {
      success: false,
      error: err.message || 'Failed to generate plan with AI.',
      code: err.code,
    };
  }
}

export async function parsePlanFromTemplateAction(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const parsed = templateImportSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid template data.',
    };
  }

  try {
    const { rawContent, format, options } = parsed.data;
    let plan: ParsedPlan;

    if (format === 'markdown') {
      plan = parseMarkdownTemplate(rawContent);
    } else if (format === 'json') {
      plan = parseJsonTemplate(rawContent);
    } else {
      plan = parseChecklistToPlan(rawContent, {
        title: options?.title,
        dayCount: options?.days,
        hoursPerDay: options?.hoursPerDay,
        priority: options?.priority,
      });
    }

    return { success: true, plan };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      error: `Failed to parse template: ${err.message || 'Invalid format'}`,
    };
  }
}

export async function confirmAndSavePlanAction(planData: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const parsed = confirmPlanSchema.safeParse(planData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Plan validation failed.',
    };
  }

  const {
    title,
    description,
    dayCount,
    priority,
    tags,
    days,
    color,
    missionId: targetMissionId,
    runwayTitle,
  } = parsed.data;
  const userId = session.user.id;

  try {
    const startDate = new Date();
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() + dayCount);

    let activeMissionId: string;

    // 1. Resolve or Create Mission (A runway CANNOT exist without a mission)
    if (targetMissionId) {
      const existing = await getMissionById(userId, targetMissionId);
      if (!existing) {
        return { success: false, error: 'Selected mission does not exist.' };
      }
      activeMissionId = existing._id.toString();
    } else {
      const newMission = await createMission(userId, {
        title,
        description: description || '',
        color: color || '#7C5CFF',
        priority,
        tags: tags || [],
        startDate,
        deadline,
        dayCount,
      });
      activeMissionId = newMission._id.toString();
    }

    // 2. Create the Runway strictly under this Mission
    const runway = await createRunway(userId, {
      missionId: activeMissionId,
      title: runwayTitle || `${title} Runway`,
      description: description || '',
      dayCount,
      startDate,
      deadline,
    });
    const runwayId = runway._id.toString();

    // 3. Create Steps linked to BOTH missionId and runwayId
    for (const day of days) {
      let previousKey: string | null = null;

      for (const step of day.steps) {
        const orderKey = generateKeyBetween(previousKey, null);
        previousKey = orderKey;

        await createStep(userId, {
          missionId: activeMissionId,
          runwayId,
          dayIndex: day.dayIndex,
          order: orderKey,
          title: step.title,
          notes: step.notes || '',
          estimateMin: step.estimateMin,
          status: 'todo',
          checklist: step.checklist?.map((c) => ({ text: c.text, done: c.done })) || [],
        });
      }
    }

    revalidatePath('/missions');
    revalidatePath(`/runway`);
    revalidatePath('/today');
    revalidatePath('/insights');

    return { success: true, missionId: activeMissionId, runwayId };
  } catch (error: unknown) {
    console.error('Save plan error:', error);
    const err = error as { message?: string };
    return {
      success: false,
      error: `Failed to save runway: ${err.message || 'Database error'}`,
    };
  }
}

export async function replanMissionAction(missionId: string, hoursPerDay = 4) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const userId = session.user.id;

  try {
    const steps = await getStepsByMission(userId, missionId);
    const incompleteSteps = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped');

    if (incompleteSteps.length === 0) {
      return { success: false, error: 'No incomplete steps to re-plan.' };
    }

    const remainingDays = Math.max(
      2,
      Math.ceil(incompleteSteps.reduce((acc, s) => acc + s.estimateMin, 0) / (hoursPerDay * 60))
    );

    const replanned = await replanMissionWithGemini({
      userId,
      missionTitle: 'Re-planned Pipeline',
      remainingDays,
      hoursPerDay,
      steps: incompleteSteps.map((s) => ({
        title: s.title,
        estimateMin: s.estimateMin,
        priority: 'medium' as const,
        notes: s.notes,
        checklist: s.checklist?.map((c) => ({ text: c.text, done: c.done })),
      })),
    });

    return { success: true, plan: replanned };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      error: `Re-planning failed: ${err.message || 'Unknown error'}`,
    };
  }
}

export async function getDailyBriefAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const todayData = await getTodayDashboardData(session.user.id);
    const brief = await generateDailyBriefWithGemini({
      userId: session.user.id,
      totalSteps: todayData.todaySteps.length,
      completedSteps: todayData.todaySteps.filter((s) => s.status === 'done').length,
      overdueSteps: 0,
      nextStepTitle: todayData.nextUpStep?.title,
    });

    return { success: true, brief };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      error: err.message || 'Could not generate briefing.',
    };
  }
}
