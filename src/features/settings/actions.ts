'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserSettings, updateUserSettings, getDecryptedGeminiKey } from '@/server/dal/settings';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { TimeLog } from '@/server/models/TimeLog';
import { Activity } from '@/server/models/Activity';
import { Template } from '@/server/models/Template';
import { Runway } from '@/server/models/Runway';
import { connectDB } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';

export async function getSettingsAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const settings = await getUserSettings(session.user.id);
    return { success: true, settings };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to fetch settings' };
  }
}

// Whitelist of fields the client may change (never trust the TypeScript type at runtime)
const updateSettingsSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    density: z.enum(['compact', 'comfortable']),
    timezone: z.string().min(1).max(64),
    weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
    workHoursPerDay: z.number().int().min(1).max(24),
    capacityByWeekday: z.record(z.number().min(0).max(24)),
    workingWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    strictSchedule: z.boolean(),
  })
  .partial()
  .strict();

export async function updateSettingsAction(data: z.input<typeof updateSettingsSchema>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = updateSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid settings' };
  }
  if (parsed.data.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone });
    } catch {
      return { success: false, error: 'Unknown timezone' };
    }
  }

  try {
    const updated = await updateUserSettings(session.user.id, {
      ...parsed.data,
      ...(parsed.data.workingWeekdays
        ? { workingWeekdays: Array.from(new Set(parsed.data.workingWeekdays)).sort() }
        : {}),
    });
    revalidatePath('/settings');
    return { success: true, settings: updated };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to update settings' };
  }
}

export async function saveCustomGeminiKeyAction(apiKey: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!apiKey || apiKey.trim().length < 10) {
    return { success: false, error: 'Please enter a valid Gemini API key' };
  }

  try {
    // Test the API key against Google Gen AI before storing
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: 'ping',
    });

    const updated = await updateUserSettings(session.user.id, {
      geminiApiKey: apiKey.trim(),
    });

    revalidatePath('/settings');
    return { success: true, settings: updated };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      error: `Invalid Gemini Key: ${err.message || 'Failed to authenticate with Google Gen AI'}`,
    };
  }
}

export async function removeCustomGeminiKeyAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const updated = await updateUserSettings(session.user.id, {
      geminiApiKey: null,
    });

    revalidatePath('/settings');
    return { success: true, settings: updated };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to remove custom key' };
  }
}

/**
 * Export all user data as structured JSON (GDPR / portable backup)
 */
export async function exportAllUserDataAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.user.id;
  await connectDB();

  try {
    const [missions, runways, steps, timeLogs, activities, templates, settings] = await Promise.all(
      [
        Runway.find({ userId }).lean().exec(),
        Mission.find({ userId }).lean().exec(),
        Step.find({ userId }).lean().exec(),
        TimeLog.find({ userId }).lean().exec(),
        Activity.find({ userId }).lean().exec(),
        Template.find({ userId }).lean().exec(),
        getUserSettings(userId),
      ]
    );

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: session.user.email,
      },
      settings,
      missions,
      runways,
      steps,
      timeLogs,
      activities,
      templates,
    };

    return {
      success: true,
      json: JSON.stringify(exportData, null, 2),
      filename: `lockin-backup-${new Date().toISOString().split('T')[0]}.json`,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Export failed' };
  }
}
