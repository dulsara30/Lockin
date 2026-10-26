import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getMissionById } from '@/server/dal/missions';
import { getMissionAccess } from '@/server/dal/access';
import { getRunwayByMission } from '@/server/dal/runways';
import { getStepsByMission } from '@/server/dal/steps';
import { getUserSettings } from '@/server/dal/settings';
import { DayPipelineView } from '@/features/runway/components/day-pipeline-view';

export const metadata: Metadata = {
  title: 'Day Focus Pipeline | Runway',
};

interface DayPipelinePageProps {
  searchParams: Promise<{ missionId?: string; dayIndex?: string }>;
}

export default async function DayPipelinePage({ searchParams }: DayPipelinePageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const resolved = await searchParams;
  const missionId = resolved.missionId;
  const dayIndex = resolved.dayIndex ? parseInt(resolved.dayIndex, 10) : 0;

  if (!missionId) {
    redirect('/runway');
  }

  const access = await getMissionAccess(userId, missionId);
  if (!access) {
    redirect('/runway');
  }
  const ownerId = access.ownerId;

  const [mission, runway, settings, steps] = await Promise.all([
    getMissionById(ownerId, missionId),
    getRunwayByMission(ownerId, missionId),
    getUserSettings(userId),
    getStepsByMission(ownerId, missionId),
  ]);

  if (!mission || !runway) {
    redirect('/runway');
  }

  const dailyCapacityMin = (settings.workHoursPerDay || 8) * 60;
  const daySteps = steps.filter((s) => s.dayIndex === dayIndex);

  // Normalize dayStartTimes to Record<string, string>
  const dayStartTimesObj: Record<string, string> = {};
  if (runway.dayStartTimes) {
    const raw =
      runway.dayStartTimes instanceof Map
        ? Object.fromEntries(runway.dayStartTimes)
        : (runway.dayStartTimes as Record<string, unknown>);
    for (const [k, v] of Object.entries(raw)) {
      if (v) dayStartTimesObj[k] = new Date(v as string | number | Date).toISOString();
    }
  }

  return (
    <div className="space-y-6">
      <DayPipelineView
        mission={{
          _id: mission._id.toString(),
          title: mission.title,
          color: mission.color,
          dayCount: mission.dayCount,
        }}
        runway={{
          _id: runway._id.toString(),
          title: runway.title,
          dayCount: runway.dayCount,
          startDate: runway.startDate?.toISOString(),
          deadline: runway.deadline?.toISOString(),
          dayStartTimes: dayStartTimesObj,
          dayFailedIndices: runway.dayFailedIndices || [],
        }}
        dayIndex={dayIndex}
        initialSteps={JSON.parse(JSON.stringify(daySteps))}
        dailyCapacityMin={runway.hoursPerDay ? runway.hoursPerDay * 60 : dailyCapacityMin}
        role={access.role}
      />
    </div>
  );
}
