'use server';

import { auth } from '@/lib/auth';
import { getUserSettings, updateUserSettings, getDecryptedGeminiKey } from '@/server/dal/settings';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { TimeLog } from '@/server/models/TimeLog';
import { Activity } from '@/server/models/Activity';
import { Template } from '@/server/models/Template';
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

export async function updateSettingsAction(data: {
  theme?: 'dark' | 'light' | 'system';
  accent?: string;
  density?: 'compact' | 'comfortable';
  timezone?: string;
  weekStart?: 0 | 1 | 6;
  workHoursPerDay?: number;
  capacityByWeekday?: Record<string, number>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const updated = await updateUserSettings(session.user.id, data);
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
    const [missions, steps, timeLogs, activities, templates, settings] = await Promise.all([
      Mission.find({ userId }).lean().exec(),
      Step.find({ userId }).lean().exec(),
      TimeLog.find({ userId }).lean().exec(),
      Activity.find({ userId }).lean().exec(),
      Template.find({ userId }).lean().exec(),
      getUserSettings(userId),
    ]);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: session.user.email,
      },
      settings,
      missions,
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

/**
 * Export single mission as Markdown format
 */
export async function exportMissionMarkdownAction(missionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.user.id;
  await connectDB();

  try {
    const mission = await Mission.findOne({ _id: missionId, userId }).lean();
    if (!mission) return { success: false, error: 'Mission not found' };

    const steps = await Step.find({ userId, missionId }).sort({ dayIndex: 1, order: 1 }).lean();

    let md = `# Mission: ${mission.title}\n`;
    md += `days: ${mission.dayCount}\n`;
    md += `hoursPerDay: 4\n`;
    md += `priority: ${mission.priority}\n`;
    if (mission.tags?.length) md += `tags: ${mission.tags.join(', ')}\n`;
    if (mission.description) md += `description: ${mission.description}\n`;
    md += '\n';

    for (let d = 0; d < mission.dayCount; d++) {
      md += `## Day ${d + 1}\n`;
      const daySteps = steps.filter((s) => s.dayIndex === d);
      if (daySteps.length === 0) {
        md += `<!-- buffer day -->\n\n`;
        continue;
      }

      for (const st of daySteps) {
        const mark = st.status === 'done' ? 'x' : ' ';
        const note = st.notes ? ` | ${st.notes}` : '';
        md += `- [${mark}] ${st.title} | ${st.estimateMin}m | medium${note}\n`;
        if (st.checklist?.length) {
          for (const item of st.checklist) {
            const subMark = item.done ? 'x' : ' ';
            md += `  - [${subMark}] ${item.text}\n`;
          }
        }
      }
      md += '\n';
    }

    const safeTitle = mission.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      success: true,
      markdown: md,
      filename: `lockin-mission-${safeTitle}.md`,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to export markdown' };
  }
}
