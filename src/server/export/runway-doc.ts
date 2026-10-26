import { requireRunwayAccess } from '@/server/dal/access';
import { getRunwayById } from '@/server/dal/runways';
import { getMissionById } from '@/server/dal/missions';
import { getStepsByRunway } from '@/server/dal/steps';
import { getUserSettings } from '@/server/dal/settings';
import type { ExportDoc } from '@/lib/export/runway-export';

/**
 * Builds the export document for a whole runway, or one day (0-based) of it.
 * Access-checked: any member (including view-only) can export what they can see.
 */
export async function loadExportDoc(
  userId: string,
  runwayId: string,
  dayIndex?: number
): Promise<ExportDoc> {
  const access = await requireRunwayAccess(userId, runwayId, 'viewer');
  const ownerId = access.ownerId;

  const [runway, mission, steps, settings] = await Promise.all([
    getRunwayById(ownerId, runwayId),
    getMissionById(ownerId, access.missionId),
    getStepsByRunway(ownerId, runwayId),
    getUserSettings(userId),
  ]);
  if (!runway || !mission) throw new Error('Runway not found');
  if (dayIndex !== undefined && dayIndex >= runway.dayCount) throw new Error('Day not found');

  const dayIndices =
    dayIndex !== undefined ? [dayIndex] : Array.from({ length: runway.dayCount }, (_, i) => i);

  return {
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
}
