import { connectDB } from '@/lib/db';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';
import { Runway } from '@/server/models/Runway';
import { getUserSettings } from '@/server/dal/settings';
import { dayDate, dayIndexForDate } from '@/lib/dates';

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
      missions: [],
    };
  }

  const now = new Date();
  const { timezone } = await getUserSettings(userId);
  const missionMap = new Map(activeMissions.map((m) => [m._id.toString(), m]));

  // "Today" is derived from each mission's ACTIVE runway (its own start date and length),
  // using calendar days in the user's timezone. Replans start a new runway, so the mission's
  // original start date would point at the wrong day.
  const runways = await Runway.find({
    userId,
    missionId: { $in: activeMissions.map((m) => m._id) },
    status: { $ne: 'archived' },
  })
    .sort({ version: -1 })
    .lean();

  const missionDays = activeMissions.map((m) => {
    const mine = runways.filter((r) => r.missionId.toString() === m._id.toString());
    const runway = mine.find((r) => r.isActive) || mine[0] || null;
    const start = runway?.startDate || m.startDate;
    const dayCount = runway?.dayCount || m.dayCount;
    const dayIndex = Math.min(dayCount - 1, Math.max(0, dayIndexForDate(start, now, timezone)));
    return { mission: m, runway, dayIndex, date: dayDate(start, dayIndex, timezone) };
  });

  const stepResults = await Promise.all(
    missionDays.map(({ mission, runway, dayIndex }) =>
      Step.find({
        userId,
        missionId: mission._id,
        dayIndex,
        // Steps of other runway versions are not part of today's plan (legacy steps have none)
        ...(runway ? { $or: [{ runwayId: runway._id }, { runwayId: { $exists: false } }] } : {}),
      })
        .sort({ order: 1 })
        .lean()
    )
  );
  const rawSteps = stepResults.flat();
  const missions = missionDays.map((d, i) => ({
    missionId: d.mission._id.toString(),
    title: d.mission.title,
    runwayId: d.runway?._id.toString() ?? null,
    runwayVersion: d.runway?.version ?? null,
    dayIndex: d.dayIndex,
    date: d.date,
    stepCount: stepResults[i].length,
  }));

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
    missions,
  };
}
