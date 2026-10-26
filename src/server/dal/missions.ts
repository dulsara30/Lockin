import { connectDB } from '@/lib/db';
import { Mission, IMission, MissionPriority, MissionStatus } from '@/server/models/Mission';
import { Runway } from '@/server/models/Runway';
import { Step } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';
import { MissionMember } from '@/server/models/MissionMember';

export interface CreateMissionDTO {
  title: string;
  description?: string;
  color?: string;
  priority?: MissionPriority;
  tags?: string[];
  startDate?: Date;
  deadline?: Date;
  dayCount?: number;
}

export interface UpdateMissionDTO {
  title?: string;
  description?: string;
  color?: string;
  priority?: MissionPriority;
  tags?: string[];
  startDate?: Date;
  deadline?: Date;
  dayCount?: number;
  status?: MissionStatus;
  archived?: boolean;
}

export async function getMissions(
  userId: string,
  options: { includeArchived?: boolean; limit?: number } = {}
) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  const filter: Record<string, unknown> = { userId };
  if (!options.includeArchived) {
    filter.archived = { $ne: true };
  }

  const query = Mission.find(filter).sort({ deadline: 1, createdAt: -1 }).lean();

  if (options.limit) {
    query.limit(options.limit);
  }

  return await query.exec();
}

export async function getMissionById(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  return await Mission.findOne({ _id: missionId, userId }).lean().exec();
}

export async function createMission(userId: string, data: CreateMissionDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  const mission = await Mission.create({
    ...data,
    userId,
  });

  await Activity.create({
    userId,
    type: 'created',
    missionId: mission._id,
    metadata: { title: `Mission created: ${mission.title}` },
    at: new Date(),
  });

  return mission.toObject();
}

export async function updateMission(userId: string, missionId: string, data: UpdateMissionDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  const updated = await Mission.findOneAndUpdate(
    { _id: missionId, userId },
    { $set: data },
    { new: true }
  )
    .lean()
    .exec();

  if (updated && data.status) {
    await Activity.create({
      userId,
      type: 'status_changed',
      missionId,
      metadata: { status: data.status },
      at: new Date(),
    });
  }

  return updated;
}

export async function deleteMission(userId: string, missionId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  // Cascade delete all steps and runways belonging to this mission
  await Step.deleteMany({ missionId, userId }).exec();
  await Runway.deleteMany({ missionId, userId }).exec();
  await Activity.deleteMany({ missionId, userId }).exec();
  await MissionMember.deleteMany({ missionId, ownerId: userId }).exec();

  const deleted = await Mission.findOneAndDelete({ _id: missionId, userId }).lean().exec();
  return deleted;
}

export async function archiveMission(userId: string, missionId: string, archived = true) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  const updated = await Mission.findOneAndUpdate(
    { _id: missionId, userId },
    { $set: { archived, status: archived ? 'archived' : 'active' } },
    { new: true }
  )
    .lean()
    .exec();

  return updated;
}
