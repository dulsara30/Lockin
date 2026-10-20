import { connectDB } from '@/lib/db';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';

export async function getTodayDashboardData(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  const activeMissions = await Mission.find({ userId, archived: false, status: 'active' }).lean();
  if (activeMissions.length === 0) {
    return {
      todaySteps: [],
      nextUpStep: null,
      totalPlannedMin: 0,
      totalCompletedMin: 0,
      streakDays: 0,
    };
  }

  const now = new Date();
  const missionMap = new Map(activeMissions.map((m) => [m._id.toString(), m]));

  // For each mission, calculate its current dayIndex relative to its startDate
  const missionDayFilters = activeMissions.map((m) => {
    const start = new Date(m.startDate).getTime();
    const diffDays = Math.max(0, Math.floor((now.getTime() - start) / (1000 * 60 * 60 * 24)));
    const dayIndex = Math.min(m.dayCount - 1, diffDays);
    return { missionId: m._id, dayIndex };
  });

  // Query steps scheduled for each mission's current day
  const stepQueries = missionDayFilters.map((f) =>
    Step.find({
      userId,
      missionId: f.missionId,
      dayIndex: f.dayIndex,
    }).lean()
  );

  const queryResults = await Promise.all(stepQueries);
  const rawSteps = queryResults.flat();

  // Attach mission metadata to each step
  const todaySteps = rawSteps.map((s) => {
    const m = missionMap.get(s.missionId.toString());
    return {
      ...s,
      missionTitle: m?.title || 'Mission',
      missionColor: m?.color || '#7C5CFF',
    };
  });

  const totalPlannedMin = todaySteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);
  const totalCompletedMin = todaySteps
    .filter((s) => s.status === 'done')
    .reduce((acc, s) => acc + (s.estimateMin || 0), 0);

  // Next up is the first uncompleted step (doing or todo)
  const nextUpStep =
    todaySteps.find((s) => s.status === 'doing') ||
    todaySteps.find((s) => s.status === 'todo') ||
    null;

  // Compute streak from activity completed events
  const recentCompletions = await Activity.find({
    userId,
    type: 'completed',
  })
    .sort({ at: -1 })
    .limit(30)
    .lean();

  const uniqueDays = new Set<string>();
  for (const act of recentCompletions) {
    const dayStr = new Date(act.at).toISOString().split('T')[0];
    uniqueDays.add(dayStr);
  }
  const streakDays = uniqueDays.size;

  return {
    todaySteps,
    nextUpStep,
    totalPlannedMin,
    totalCompletedMin,
    streakDays,
  };
}
