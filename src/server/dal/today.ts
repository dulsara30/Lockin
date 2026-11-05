import { connectDB } from '@/lib/db';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';
import { Runway } from '@/server/models/Runway';
import { MissionMember } from '@/server/models/MissionMember';
import { getUserSettings } from '@/server/dal/settings';
import { DayState, dateForDay, dayStateFor, todayInTz } from '@/lib/calendar';
import { runwaySchedule } from '@/server/dal/schedule';

export async function getTodayDashboardData(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  // Missions I own plus missions shared with me (editor or viewer). Each mission's data lives
  // under its OWNER's tenant, so owner ids come from verified membership grants only.
  const grants = await MissionMember.find({ userId }).lean();
  const roleByMission = new Map<string, string>(
    grants.map((g) => [g.missionId.toString(), g.role])
  );
  const activeMissions = await Mission.find({
    archived: false,
    status: 'active',
    $or: [{ userId }, ...grants.map((g) => ({ _id: g.missionId, userId: g.ownerId }))],
  }).lean();
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

  const { timezone } = await getUserSettings(userId);
  const today = todayInTz(timezone);
  const missionMap = new Map(activeMissions.map((m) => [m._id.toString(), m]));

  // "Today" is derived from each mission's ACTIVE runway (its own start date and length),
  // using calendar days in the user's timezone. Replans start a new runway, so the mission's
  // original start date would point at the wrong day.
  const runways = await Runway.find({
    $or: activeMissions.map((m) => ({ missionId: m._id, userId: m.userId })),
    status: { $ne: 'archived' },
  })
    .sort({ version: -1 })
    .lean();

  // Only runways that are running AND on a working date contribute steps today. Unscheduled,
  // upcoming, ended and rest-day cases are reported in the missions summary instead.
  const missionDays = activeMissions.map((m) => {
    const mine = runways.filter((r) => r.missionId.toString() === m._id.toString());
    const runway = mine.find((r) => r.isActive) || mine[0] || null;
    const schedule = runway ? runwaySchedule(runway, timezone) : null;
    const state: DayState =
      runway && schedule ? dayStateFor(schedule, runway.dayCount, today) : { state: 'unscheduled' };
    const dayIndex = state.state === 'working' ? state.dayIndex : null;
    const date = schedule && dayIndex !== null ? dateForDay(schedule, dayIndex) : null;
    return { mission: m, runway, state, dayIndex, date };
  });

  const stepResults = await Promise.all(
    missionDays.map(({ mission, runway, dayIndex }) =>
      dayIndex === null
        ? Promise.resolve([])
        : Step.find({
            userId: mission.userId,
            missionId: mission._id,
            dayIndex,
            // Steps of other runway versions are not part of today's plan (legacy steps have none)
            ...(runway
              ? { $or: [{ runwayId: runway._id }, { runwayId: { $exists: false } }] }
              : {}),
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
    role: roleByMission.get(d.mission._id.toString()) ?? 'owner',
    schedule: d.state,
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
      missionRole: roleByMission.get(s.missionId.toString()) ?? 'owner',
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
