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
}

export interface UpdateRunwayDTO {
  title?: string;
  description?: string;
  dayCount?: number;
  startDate?: Date;
  deadline?: Date;
  status?: RunwayStatus;
}

export async function getRunwayByMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  return await Runway.findOne({ userId, missionId, status: { $ne: 'archived' } })
    .lean()
    .exec();
}

export async function getRunwaysByMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  return await Runway.find({ userId, missionId, status: { $ne: 'archived' } })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
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

  // Enforce rule: A mission cannot have multiple runways
  const existing = await Runway.findOne({
    userId,
    missionId: data.missionId,
    status: { $ne: 'archived' },
  }).lean();

  if (existing) {
    throw new Error('This mission already has a runway. A mission cannot have multiple runways.');
  }

  const runway = await Runway.create({
    ...data,
    userId,
    status: 'active',
  });

  await Activity.create({
    userId,
    type: 'created',
    missionId: data.missionId,
    metadata: { title: `Runway created: ${runway.title}`, runwayId: runway._id },
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
