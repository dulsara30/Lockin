'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { requireMissionAccess, AccessError } from '@/server/dal/access';
import {
  addMember,
  leaveMission,
  listMembers,
  removeMember,
  updateMemberRole,
} from '@/server/dal/members';
import {
  addMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  AddMemberInput,
} from './schemas';

async function getRequiredUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

/** Only expose messages we deliberately wrote; hide anything unexpected. */
function toError(error: unknown) {
  const known =
    error instanceof AccessError ||
    (error instanceof Error &&
      /^(No Lockin account|You already own|A mission can be shared|That person already|Member not found|Mission not found|Unauthorized)/.test(
        error.message
      ));
  return {
    success: false as const,
    error: known && error instanceof Error ? error.message : 'Something went wrong',
  };
}

function refresh(missionId: string) {
  revalidatePath('/missions');
  revalidatePath(`/missions/${missionId}`);
  revalidatePath('/runway');
}

export async function actionListMembers(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    const access = await requireMissionAccess(userId, missionId, 'viewer');
    const members = await listMembers(access.ownerId, missionId);
    return { success: true as const, data: members, role: access.role };
  } catch (error) {
    return toError(error);
  }
}

export async function actionAddMember(raw: AddMemberInput) {
  try {
    const userId = await getRequiredUserId();
    const parsed = addMemberSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }
    const { missionId, email, role } = parsed.data;

    // Only the owner can share; throttle to blunt account enumeration and spam
    await requireMissionAccess(userId, missionId, 'owner');
    const limit = await checkRateLimit(`share:${userId}`, 20, 3600);
    if (!limit.success) {
      return { success: false as const, error: 'Too many invitations. Try again later.' };
    }

    await addMember(userId, missionId, email, role, userId);
    refresh(missionId);
    return { success: true as const };
  } catch (error) {
    return toError(error);
  }
}

export async function actionUpdateMemberRole(raw: unknown) {
  try {
    const userId = await getRequiredUserId();
    const parsed = updateMemberRoleSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: 'Invalid input' };
    const { missionId, memberUserId, role } = parsed.data;

    await requireMissionAccess(userId, missionId, 'owner');
    await updateMemberRole(userId, missionId, memberUserId, role, userId);
    refresh(missionId);
    return { success: true as const };
  } catch (error) {
    return toError(error);
  }
}

export async function actionRemoveMember(raw: unknown) {
  try {
    const userId = await getRequiredUserId();
    const parsed = removeMemberSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: 'Invalid input' };
    const { missionId, memberUserId } = parsed.data;

    await requireMissionAccess(userId, missionId, 'owner');
    await removeMember(userId, missionId, memberUserId, userId);
    refresh(missionId);
    return { success: true as const };
  } catch (error) {
    return toError(error);
  }
}

/** A collaborator removes their own access. Owners cannot leave (they delete or transfer). */
export async function actionLeaveMission(missionId: string) {
  try {
    const userId = await getRequiredUserId();
    const access = await requireMissionAccess(userId, missionId, 'viewer');
    if (access.role === 'owner') {
      return { success: false as const, error: 'Owners cannot leave their own mission.' };
    }
    await leaveMission(userId, missionId);
    refresh(missionId);
    return { success: true as const };
  } catch (error) {
    return toError(error);
  }
}
