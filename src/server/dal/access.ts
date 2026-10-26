import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { Runway } from '@/server/models/Runway';
import { MissionMember } from '@/server/models/MissionMember';
import { MissionRole, roleAtLeast } from '@/lib/access';

/**
 * Central authorization layer for missions.
 *
 * Tenancy model: every mission, runway and step is stored under the OWNER's userId.
 * A collaborator never gets their own copy; they get a MissionMember grant. Every
 * action resolves (actor -> role + ownerId) here on EVERY request (no cached claims),
 * then calls the owner-scoped DAL with ownerId. Revoking a grant is therefore instant.
 *
 * Callers that are denied see "not found" for non-members (no existence disclosure)
 * and an explicit permission error only for members with an insufficient role.
 */
export class AccessError extends Error {
  constructor(message = 'Mission not found') {
    super(message);
    this.name = 'AccessError';
  }
}

export interface MissionAccess {
  missionId: string;
  ownerId: string;
  role: MissionRole;
}

const isId = (id: unknown): id is string => typeof id === 'string' && mongoose.isValidObjectId(id);

export async function getMissionAccess(
  actorId: string,
  missionId: string
): Promise<MissionAccess | null> {
  if (!actorId) throw new Error('Security Error: userId is required');
  if (!isId(missionId)) return null;
  await connectDB();

  const owned = await Mission.exists({ _id: missionId, userId: actorId });
  if (owned) return { missionId, ownerId: actorId, role: 'owner' };

  const grant = await MissionMember.findOne({ missionId, userId: actorId }).lean().exec();
  if (!grant) return null;

  // Defense in depth: the mission must still exist under the grant's owner
  const exists = await Mission.exists({ _id: missionId, userId: grant.ownerId });
  if (!exists) return null;

  return { missionId, ownerId: grant.ownerId, role: grant.role };
}

export async function requireMissionAccess(
  actorId: string,
  missionId: string,
  min: MissionRole = 'viewer'
): Promise<MissionAccess> {
  const access = await getMissionAccess(actorId, missionId);
  if (!access) throw new AccessError();
  if (!roleAtLeast(access.role, min)) {
    throw new AccessError('You do not have permission to perform this action');
  }
  return access;
}

async function reachableFilter(actorId: string): Promise<Record<string, unknown>[]> {
  const grants = await MissionMember.find({ userId: actorId }).lean().exec();
  const reach: Record<string, unknown>[] = [{ userId: actorId }];
  for (const g of grants) reach.push({ missionId: g.missionId, userId: g.ownerId });
  return reach;
}

/** Resolve access for a step by id, constrained to missions the actor can reach. */
export async function requireStepAccess(
  actorId: string,
  stepId: string,
  min: MissionRole = 'viewer'
): Promise<MissionAccess & { stepMissionId: string }> {
  if (!actorId) throw new Error('Security Error: userId is required');
  if (!isId(stepId)) throw new AccessError('Step not found');
  await connectDB();

  const step = await Step.findOne({ _id: stepId, $or: await reachableFilter(actorId) })
    .select('missionId')
    .lean()
    .exec();
  if (!step) throw new AccessError('Step not found');

  const missionId = step.missionId.toString();
  const access = await requireMissionAccess(actorId, missionId, min);
  return { ...access, stepMissionId: missionId };
}

/** Resolve access for a runway by id, constrained to missions the actor can reach. */
export async function requireRunwayAccess(
  actorId: string,
  runwayId: string,
  min: MissionRole = 'viewer'
): Promise<MissionAccess> {
  if (!actorId) throw new Error('Security Error: userId is required');
  if (!isId(runwayId)) throw new AccessError('Runway not found');
  await connectDB();

  const runway = await Runway.findOne({ _id: runwayId, $or: await reachableFilter(actorId) })
    .select('missionId')
    .lean()
    .exec();
  if (!runway) throw new AccessError('Runway not found');

  return requireMissionAccess(actorId, runway.missionId.toString(), min);
}
