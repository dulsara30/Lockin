import { connectDB } from '@/lib/db';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';

export interface MissionProgressRing {
  missionId: string;
  title: string;
  color: string;
  completionPercent: number;
  completedSteps: number;
  totalSteps: number;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface DayActivityDistribution {
  day: string; // 'Mon', 'Tue', etc.
  completedSteps: number;
  actualHours: number;
}

export interface BurnDownPoint {
  dayLabel: string;
  plannedRemaining: number;
  idealRemaining: number;
  actualRemaining: number;
}

export interface InsightsData {
  completionRatePercent: number;
  totalPlannedHours: number;
  totalActualHours: number;
  currentStreak: number;
  longestStreak: number;
  busiestDays: DayActivityDistribution[];
  missionProgressRings: MissionProgressRing[];
  burnDownPoints: BurnDownPoint[];
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  selectedMissionId?: string;
  missionsList: Array<{ _id: string; title: string; color: string }>;
}

export async function getInsightsData(userId: string, missionId?: string): Promise<InsightsData> {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  const [missions, allSteps, allActivities] = await Promise.all([
    Mission.find({ userId }).sort({ deadline: 1 }).lean().exec(),
    Step.find({ userId }).lean().exec(),
    Activity.find({ userId }).sort({ at: 1 }).lean().exec(),
  ]);

  // If missionId is provided and valid, filter steps and activities to that mission
  const activeMission = missionId ? missions.find((m) => m._id.toString() === missionId) : null;
  const filteredSteps = activeMission
    ? allSteps.filter((s) => s.missionId.toString() === missionId)
    : allSteps;
  const filteredActivities = activeMission
    ? allActivities.filter((a) => a.missionId?.toString() === missionId)
    : allActivities;

  const totalSteps = filteredSteps.length;
  const completedSteps = filteredSteps.filter((s) => s.status === 'done').length;
  const completionRatePercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const totalPlannedMinutes = filteredSteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);
  const totalActualMinutes = filteredSteps.reduce((acc, s) => acc + (s.actualMin || 0), 0);

  // Compute Streaks from Activity
  const activityDays = new Set<string>();
  for (const act of filteredActivities) {
    if (act.at) {
      const d = new Date(act.at).toISOString().split('T')[0];
      activityDays.add(d);
    }
  }

  const sortedDays = Array.from(activityDays).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  for (const dayStr of sortedDays) {
    const curDate = new Date(dayStr);
    if (!prevDate) {
      runningStreak = 1;
    } else {
      const diffTime = curDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      if (diffDays === 1) {
        runningStreak += 1;
      } else {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreak) longestStreak = runningStreak;
    prevDate = curDate;
  }

  if (sortedDays.length > 0) {
    const lastActive = new Date(sortedDays[sortedDays.length - 1]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 3600 * 24));
    currentStreak = diff <= 1 ? runningStreak : 0;
  }

  // Busiest Days of Week (0=Sun, 1=Mon, ..., 6=Sat)
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets: Record<number, { completedSteps: number; actualMinutes: number }> = {
    0: { completedSteps: 0, actualMinutes: 0 },
    1: { completedSteps: 0, actualMinutes: 0 },
    2: { completedSteps: 0, actualMinutes: 0 },
    3: { completedSteps: 0, actualMinutes: 0 },
    4: { completedSteps: 0, actualMinutes: 0 },
    5: { completedSteps: 0, actualMinutes: 0 },
    6: { completedSteps: 0, actualMinutes: 0 },
  };

  for (const step of filteredSteps) {
    if (step.status === 'done' && step.updatedAt) {
      const dayIdx = new Date(step.updatedAt).getDay();
      dayBuckets[dayIdx].completedSteps += 1;
      dayBuckets[dayIdx].actualMinutes += step.actualMin || step.estimateMin || 0;
    }
  }

  const busiestDays: DayActivityDistribution[] = [1, 2, 3, 4, 5, 6, 0].map((idx) => ({
    day: weekdayNames[idx],
    completedSteps: dayBuckets[idx].completedSteps,
    actualHours: Math.round((dayBuckets[idx].actualMinutes / 60) * 10) / 10,
  }));

  // Mission Progress Rings & Breakdown
  const missionProgressRings: MissionProgressRing[] = missions
    .filter((m) => !m.archived && (!activeMission || m._id.toString() === missionId))
    .map((m) => {
      const mSteps = allSteps.filter((s) => s.missionId.toString() === m._id.toString());
      const mTotal = mSteps.length;
      const mCompleted = mSteps.filter((s) => s.status === 'done').length;
      const mPlanned = mSteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);
      const mActual = mSteps.reduce((acc, s) => acc + (s.actualMin || 0), 0);

      return {
        missionId: m._id.toString(),
        title: m.title,
        color: m.color || '#7C5CFF',
        completionPercent: mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0,
        completedSteps: mCompleted,
        totalSteps: mTotal,
        plannedMinutes: mPlanned,
        actualMinutes: mActual,
      };
    });

  // Burn-Down Curve Simulation
  const totalPlannedHours = Math.round((totalPlannedMinutes / 60) * 10) / 10;
  const totalActualHours = Math.round((totalActualMinutes / 60) * 10) / 10;
  const burnDownPoints: BurnDownPoint[] = [];

  const pointsCount = 7;
  for (let i = 0; i <= pointsCount; i++) {
    const fraction = i / pointsCount;
    const ideal = Math.max(0, Math.round(totalPlannedHours * (1 - fraction) * 10) / 10);
    const completedFraction =
      (completedSteps / Math.max(1, totalSteps)) * Math.min(1, fraction * 1.3);
    const actualRem = Math.max(
      0,
      Math.round(totalPlannedHours * (1 - completedFraction) * 10) / 10
    );

    burnDownPoints.push({
      dayLabel: `Day ${i}`,
      plannedRemaining: totalPlannedHours,
      idealRemaining: ideal,
      actualRemaining: actualRem,
    });
  }

  const activeMissions = missions.filter((m) => !m.archived && m.status === 'active').length;
  const completedMissions = missions.filter((m) => m.status === 'completed').length;

  return {
    completionRatePercent,
    totalPlannedHours,
    totalActualHours,
    currentStreak,
    longestStreak,
    busiestDays,
    missionProgressRings,
    burnDownPoints,
    totalMissions: missions.length,
    activeMissions,
    completedMissions,
    selectedMissionId: activeMission ? activeMission._id.toString() : undefined,
    missionsList: missions.map((m) => ({
      _id: m._id.toString(),
      title: m.title,
      color: m.color || '#7C5CFF',
    })),
  };
}
