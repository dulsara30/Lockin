import { describe, it, expect } from 'vitest';
import { roleAtLeast, canEdit, canManageMembers } from '@/lib/access';
import {
  addMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from '@/features/sharing/schemas';

const missionId = 'a'.repeat(24);

describe('Role policy', () => {
  it('orders roles viewer < editor < owner', () => {
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
    expect(roleAtLeast('editor', 'owner')).toBe(false);
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
  });

  it('only editors and owners can edit', () => {
    expect(canEdit('viewer')).toBe(false);
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('owner')).toBe(true);
  });

  it('only the owner can manage members', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('editor')).toBe(false);
    expect(canManageMembers('viewer')).toBe(false);
  });
});

describe('Sharing schemas', () => {
  it('normalizes the invited email', () => {
    const r = addMemberSchema.safeParse({
      missionId,
      email: '  Friend@Example.COM ',
      role: 'viewer',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('friend@example.com');
  });

  it('rejects the owner role and unknown roles (no privilege escalation by payload)', () => {
    expect(addMemberSchema.safeParse({ missionId, email: 'a@b.co', role: 'owner' }).success).toBe(
      false
    );
    expect(
      updateMemberRoleSchema.safeParse({ missionId, memberUserId: 'u1', role: 'admin' }).success
    ).toBe(false);
  });

  it('rejects malformed mission ids and emails', () => {
    expect(
      addMemberSchema.safeParse({ missionId: '123', email: 'a@b.co', role: 'viewer' }).success
    ).toBe(false);
    expect(addMemberSchema.safeParse({ missionId, email: 'nope', role: 'viewer' }).success).toBe(
      false
    );
    expect(
      removeMemberSchema.safeParse({ missionId: { $ne: null }, memberUserId: 'u' }).success
    ).toBe(false);
  });
});
