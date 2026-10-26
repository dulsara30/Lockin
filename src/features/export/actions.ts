'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { requireRunwayAccess } from '@/server/dal/access';
import { getRunwayById } from '@/server/dal/runways';
import { getMissionById } from '@/server/dal/missions';
import { getStepsByRunway } from '@/server/dal/steps';
import { getUserSettings } from '@/server/dal/settings';
import { EXPORT_FORMATS, ExportDoc, renderExport } from '@/lib/export/runway-export';

const exportSchema = z.object({
  runwayId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid runway'),
  dayIndex: z.number().int().min(0).max(29).optional(),
  format: z.enum(EXPORT_FORMATS),
});

export type ExportRunwayInput = z.input<typeof exportSchema>;

/**
 * Export a whole runway (all days) or a single day. Any member, including view-only,
 * may export what they can see.
 */
export async function actionExportRunway(raw: ExportRunwayInput) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false as const, error: 'Unauthorized' };

  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: 'Invalid export request' };
  const { runwayId, dayIndex, format } = parsed.data;

  try {
    const limit = await checkRateLimit(`export:${userId}`, 30, 60);
    if (!limit.success) {
      return { success: false as const, error: 'Too many exports. Try again in a minute.' };
    }

    const access = await requireRunwayAccess(userId, runwayId, 'viewer');
    const ownerId = access.ownerId;

    const [runway, mission, steps, settings] = await Promise.all([
      getRunwayById(ownerId, runwayId),
      getMissionById(ownerId, access.missionId),
      getStepsByRunway(ownerId, runwayId),
      getUserSettings(userId),
    ]);
    if (!runway || !mission) return { success: false as const, error: 'Runway not found' };
    if (dayIndex !== undefined && dayIndex >= runway.dayCount) {
      return { success: false as const, error: 'Day not found' };
    }

    const dayIndices =
      dayIndex !== undefined ? [dayIndex] : Array.from({ length: runway.dayCount }, (_, i) => i);

    const doc: ExportDoc = {
      mission: {
        title: mission.title,
        description: mission.description || '',
        priority: mission.priority,
        tags: mission.tags || [],
      },
      runway: { title: runway.title, version: runway.version || 1, dayCount: runway.dayCount },
      hoursPerDay: settings.workHoursPerDay || 4,
      scope: dayIndex !== undefined ? 'day' : 'runway',
      days: dayIndices.map((d) => ({
        dayIndex: d,
        steps: steps
          .filter((s) => s.dayIndex === d)
          .sort((a, b) => a.order.localeCompare(b.order))
          .map((s) => ({
            title: s.title,
            status: s.status,
            estimateMin: s.estimateMin,
            actualMin: s.actualMin || 0,
            notes: s.notes || '',
            checklist: (s.checklist || []).map((c) => ({ text: c.text, done: !!c.done })),
          })),
      })),
      exportedAt: new Date().toISOString(),
    };

    return { success: true as const, ...renderExport(doc, format) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      success: false as const,
      error: /not found|permission/i.test(message) ? message : 'Export failed',
    };
  }
}
