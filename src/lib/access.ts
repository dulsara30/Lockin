/**
 * Pure, dependency-free role policy for mission sharing.
 * Kept free of DB imports so it can be unit tested and reused on the client.
 */
export type MemberRole = 'viewer' | 'editor';
export type MissionRole = MemberRole | 'owner';

const ROLE_RANK: Record<MissionRole, number> = { viewer: 1, editor: 2, owner: 3 };

export const MAX_MEMBERS_PER_MISSION = 25;

export function roleAtLeast(actual: MissionRole, required: MissionRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export const canEdit = (role: MissionRole) => roleAtLeast(role, 'editor');
export const canManageMembers = (role: MissionRole) => role === 'owner';
