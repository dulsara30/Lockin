import { connectDB } from '@/lib/db';
import { Runway, IRunway, RunwayStatus } from '@/server/models/Runway';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';

export interface CreateRunwayDTO {
  missionId: string;
  title: string;
  description?: string;
  dayCount: number;
  startDate?: Date;
  deadline: Date;
  version?: number;
  isOriginal?: boolean;
}

export interface UpdateRunwayDTO {
  title?: string;
  description?: string;
  dayCount?: number;
  startDate?: Date;
  deadline?: Date;
  status?: RunwayStatus;
  isActive?: boolean;
}

export async function getRunwayByMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  // Return active runway first, or the latest one
  const active = await Runway.findOne({
    userId,
    missionId,
    isActive: true,
    status: { $ne: 'archived' },
  })
    .lean()
    .exec();

  if (active) return active;

  return await Runway.findOne({ userId, missionId, status: { $ne: 'archived' } })
    .sort({ version: -1, createdAt: -1 })
    .lean()
    .exec();
}

export async function getRunwaysByMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  return await Runway.find({ userId, missionId, status: { $ne: 'archived' } })
    .sort({ version: 1, createdAt: 1 })
    .lean()
    .exec();
}

export async function getRunwayVersionsByMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  return await Runway.find({ userId, missionId }).sort({ version: 1, createdAt: 1 }).lean().exec();
}

export async function getAllRunways(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  return await Runway.find({ userId, status: { $ne: 'archived' } })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}

export async function getRunwayById(userId: string, runwayId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  return await Runway.findOne({ _id: runwayId, userId }).lean().exec();
}

export async function createRunway(userId: string, data: CreateRunwayDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!data.missionId)
    throw new Error('missionId is required. A runway cannot exist without a mission.');
  await connectDB();

  // Determine version: find max existing version for this mission
  const existingVersions = await Runway.find({ userId, missionId: data.missionId })
    .sort({ version: -1 })
    .limit(1)
    .lean();

  const nextVersion = existingVersions.length > 0 ? (existingVersions[0].version || 1) + 1 : 1;
  const isOriginal = nextVersion === 1;

  // Deactivate previous active runways if creating a new replanned runway
  if (existingVersions.length > 0) {
    await Runway.updateMany(
      { userId, missionId: data.missionId, isActive: true },
      { $set: { isActive: false } }
    );
  }

  const runway = await Runway.create({
    ...data,
    userId,
    status: 'active',
    version: data.version ?? nextVersion,
    isOriginal: data.isOriginal ?? isOriginal,
    isActive: true,
  });

  await Activity.create({
    userId,
    type: 'created',
    missionId: data.missionId,
    metadata: {
      title: `Runway created: ${runway.title} (v${runway.version})`,
      runwayId: runway._id,
      version: runway.version,
    },
    at: new Date(),
  });

  return runway.toObject();
}

export async function updateRunway(userId: string, runwayId: string, data: UpdateRunwayDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  const updated = await Runway.findOneAndUpdate(
    { _id: runwayId, userId },
    { $set: data },
    { new: true }
  )
    .lean()
    .exec();

  return updated;
}

export async function deleteRunway(userId: string, runwayId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  // Cascade delete steps belonging to this runway
  await Step.deleteMany({ runwayId, userId }).exec();
  const deleted = await Runway.findOneAndDelete({ _id: runwayId, userId }).lean().exec();
  return deleted;
}

export async function startDay(userId: string, runwayId: string, dayIndex: number) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  const key = `dayStartTimes.${dayIndex}`;
  const updated = await Runway.findOneAndUpdate(
    { _id: runwayId, userId },
    { $set: { [key]: new Date() } },
    { new: true }
  )
    .lean()
    .exec();

  return updated;
}

export async function markDayFailed(userId: string, runwayId: string, dayIndex: number) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  const updated = await Runway.findOneAndUpdate(
    { _id: runwayId, userId },
    { $addToSet: { dayFailedIndices: dayIndex } },
    { new: true }
  )
    .lean()
    .exec();

  return updated;
}

export async function switchActiveRunway(userId: string, missionId: string, runwayId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  await Runway.updateMany({ userId, missionId }, { $set: { isActive: false } });

  const updated = await Runway.findOneAndUpdate(
    { _id: runwayId, userId, missionId },
    { $set: { isActive: true } },
    { new: true }
  )
    .lean()
    .exec();

  return updated;
}
