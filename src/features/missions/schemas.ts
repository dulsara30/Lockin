import { z } from 'zod';

export const createMissionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .default('#7C5CFF'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  tags: z.array(z.string().trim()).default([]),
  startDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  deadline: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  dayCount: z.number().int().min(1).max(30).default(5),
});

export const updateMissionSchema = createMissionSchema.partial().extend({
  status: z.enum(['active', 'completed', 'archived']).optional(),
  archived: z.boolean().optional(),
});

export const checklistItemSchema = z.object({
  text: z.string().trim().min(1),
  done: z.boolean().default(false),
});

export const createStepSchema = z.object({
  missionId: z.string().min(1),
  dayIndex: z.number().int().min(0),
  title: z.string().trim().min(1, 'Title is required').max(200),
  notes: z.string().max(10000).optional().default(''),
  estimateMin: z.number().int().min(0).max(1440).default(30),
  status: z.enum(['todo', 'doing', 'done', 'blocked', 'skipped']).default('todo'),
  checklist: z.array(checklistItemSchema).default([]),
  order: z.string().optional(),
});

export const updateStepSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(10000).optional(),
  estimateMin: z.number().int().min(0).max(1440).optional(),
  actualMin: z.number().int().min(0).optional(),
  status: z.enum(['todo', 'doing', 'done', 'blocked', 'skipped']).optional(),
  dayIndex: z.number().int().min(0).optional(),
  order: z.string().optional(),
  checklist: z.array(checklistItemSchema).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const reorderStepSchema = z.object({
  stepId: z.string().min(1),
  newDayIndex: z.number().int().min(0),
  newOrder: z.string().min(1),
});

export const rolloverSchema = z.object({
  missionId: z.string().min(1),
  moves: z.array(
    z.object({
      id: z.string().min(1),
      toDay: z.number().int().min(0),
    })
  ),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type CreateStepInput = z.infer<typeof createStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
