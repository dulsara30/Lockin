import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const memberId = z.string().min(1).max(64);

export const memberRoleSchema = z.enum(['viewer', 'editor']);

export const addMemberSchema = z.object({
  missionId: objectId,
  email: z
    .string()
    .trim()
    .max(254)
    .email('Enter a valid email address')
    .transform((v) => v.toLowerCase()),
  role: memberRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  missionId: objectId,
  memberUserId: memberId,
  role: memberRoleSchema,
});

export const removeMemberSchema = z.object({
  missionId: objectId,
  memberUserId: memberId,
});

export type AddMemberInput = z.input<typeof addMemberSchema>;
