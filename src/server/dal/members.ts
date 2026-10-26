import { connectDB } from '@/lib/db';
import { User } from '@/server/models/User';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Runway } from '@/server/models/Runway';
import { Activity } from '@/server/models/Activity';
import { MissionMember } from '@/server/models/MissionMember';
import { MAX_MEMBERS_PER_MISSION, MemberRole, MissionRole } from '@/lib/access';

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  role: MissionRole;
  isOwner: boolean;
  addedAt?: string;
}

/** Owner-scoped: `ownerId` must be the mission owner (resolved via requireMissionAccess). */
export async function listMembers(ownerId: string, missionId: string): Promise<MemberView[]> {
  if (!ownerId) throw new Error('Security Error: userId is required');
  await connectDB();

  const grants = await MissionMember.find({ missionId, ownerId }).sort({ createdAt: 1 }).lean();
  const ids = [ownerId, ...grants.map((g) => g.userId)];
  const users = await User.find({ _id: { $in: ids } })
    .select('name email')
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  const owner = byId.get(ownerId);
  const members: MemberView[] = [
    {
      userId: ownerId,
      name: owner?.name || owner?.email?.split('@')[0] || 'Owner',
      email: owner?.email || '',
      role: 'owner',
      isOwner: true,
    },
  ];
  for (const g of grants) {
    const u = byId.get(g.userId);
    members.push({
      userId: g.userId,
      name: u?.name || g.email.split('@')[0],
      email: u?.email || g.email,
      role: g.role,
      isOwner: false,
      addedAt: g.createdAt?.toISOString(),
    });
  }
  return members;
}

export async function addMember(
  ownerId: string,
  missionId: string,
  email: string,
  role: MemberRole,
  invitedBy: string
) {
  if (!ownerId) throw new Error('Security Error: userId is required');
  await connectDB();

  const target = await User.findOne({ email: email.trim().toLowerCase() })
    .select('email name')
    .lean();
  if (!target) {
    throw new Error(
      'No Lockin account found for that email. Ask them to sign up (email or Google) first.'
    );
  }
  const targetId = target._id.toString();
  if (targetId === ownerId) throw new Error('You already own this mission.');

  const count = await MissionMember.countDocuments({ missionId, ownerId });
  if (count >= MAX_MEMBERS_PER_MISSION) {
    throw new Error(`A mission can be shared with at most ${MAX_MEMBERS_PER_MISSION} people.`);
  }

  try {
    await MissionMember.create({
      missionId,
      ownerId,
      userId: targetId,
      email: target.email,
      role,
      invitedBy,
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      throw new Error('That person already has access. Change their role instead.');
    }
    throw e;
  }

  await Activity.create({
    userId: ownerId,
    type: 'member_added',
    missionId,
    metadata: { memberId: targetId, email: target.email, role, by: invitedBy },
    at: new Date(),
  });
}

export async function updateMemberRole(
  ownerId: string,
  missionId: string,
  memberUserId: string,
  role: MemberRole,
  by: string
) {
  if (!ownerId) throw new Error('Security Error: userId is required');
  await connectDB();

  const updated = await MissionMember.findOneAndUpdate(
    { missionId, ownerId, userId: memberUserId },
    { $set: { role } },
    { new: true }
  ).lean();
  if (!updated) throw new Error('Member not found');

  await Activity.create({
    userId: ownerId,
    type: 'member_role_changed',
    missionId,
    metadata: { memberId: memberUserId, role, by },
    at: new Date(),
  });
}

export async function removeMember(
  ownerId: string,
  missionId: string,
  memberUserId: string,
  by: string
) {
  if (!ownerId) throw new Error('Security Error: userId is required');
  await connectDB();

  const res = await MissionMember.deleteOne({ missionId, ownerId, userId: memberUserId });
  if (res.deletedCount === 0) throw new Error('Member not found');

  await Activity.create({
    userId: ownerId,
    type: 'member_removed',
    missionId,
    metadata: { memberId: memberUserId, by },
    at: new Date(),
  });
}

/** A member removes THEIR OWN grant. Scoped by (missionId, userId=actor). */
export async function leaveMission(actorId: string, missionId: string) {
  if (!actorId) throw new Error('Security Error: userId is required');
  await connectDB();

  const grant = await MissionMember.findOneAndDelete({ missionId, userId: actorId }).lean();
  if (!grant) throw new Error('Mission not found');

  await Activity.create({
    userId: grant.ownerId,
    type: 'member_removed',
    missionId,
    metadata: { memberId: actorId, by: actorId, left: true },
    at: new Date(),
  });
}

/** Owner-scoped: number of collaborators per mission, for list badges. */
export async function getMemberCounts(ownerId: string): Promise<Map<string, number>> {
  if (!ownerId) throw new Error('Security Error: userId is required');
  await connectDB();

  const rows = await MissionMember.aggregate<{ _id: unknown; count: number }>([
    { $match: { ownerId } },
    { $group: { _id: '$missionId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export interface SharedMissionRow {
  mission: Record<string, unknown>;
  role: MemberRole;
  ownerName: string;
  ownerEmail: string;
  stepCount: number;
  completedStepCount: number;
  runwayCount: number;
}

/** Missions other people shared with `actorId`, with progress stats. */
export async function getSharedMissions(actorId: string): Promise<SharedMissionRow[]> {
  if (!actorId) throw new Error('Security Error: userId is required');
  await connectDB();

  const grants = await MissionMember.find({ userId: actorId }).lean();
  if (grants.length === 0) return [];

  const missionPairs = grants.map((g) => ({ _id: g.missionId, userId: g.ownerId }));
  const childPairs = grants.map((g) => ({ missionId: g.missionId, userId: g.ownerId }));

  const [missions, steps, runways, owners] = await Promise.all([
    Mission.find({ $or: missionPairs, archived: { $ne: true } })
      .sort({ deadline: 1 })
      .lean(),
    Step.find({ $or: childPairs }).select('missionId status').lean(),
    Runway.find({ $or: childPairs, status: { $ne: 'archived' } })
      .select('missionId')
      .lean(),
    User.find({ _id: { $in: [...new Set(grants.map((g) => g.ownerId))] } })
      .select('name email')
      .lean(),
  ]);

  const ownerById = new Map(owners.map((o) => [o._id.toString(), o]));
  const roleByMission = new Map(grants.map((g) => [g.missionId.toString(), g.role]));

  return missions.map((m) => {
    const id = m._id.toString();
    const mSteps = steps.filter((s) => s.missionId.toString() === id);
    const owner = ownerById.get(m.userId);
    return {
      mission: m as unknown as Record<string, unknown>,
      role: roleByMission.get(id) || 'viewer',
      ownerName: owner?.name || owner?.email?.split('@')[0] || 'Someone',
      ownerEmail: owner?.email || '',
      stepCount: mSteps.length,
      completedStepCount: mSteps.filter((s) => s.status === 'done').length,
      runwayCount: runways.filter((r) => r.missionId.toString() === id).length,
    };
  });
}
