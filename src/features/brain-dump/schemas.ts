import { z } from 'zod';
import { planSchema, planStepSchema, planDaySchema } from '@/lib/templates/parser';

export const brainDumpAiInputSchema = z.object({
  prompt: z
    .string()
    .min(5, 'Please provide more details on what you want to achieve')
    .max(5000, 'Prompt too long (max 5000 characters)'),
  days: z.coerce.number().int().min(1).max(30).default(5),
  hoursPerDay: z.coerce.number().int().min(1).max(16).default(4),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  missionId: z.string().optional(),
});

export const templateImportSchema = z.object({
  rawContent: z.string().min(5, 'Template content cannot be empty'),
  format: z.enum(['markdown', 'json', 'checklist']),
  options: z
    .object({
      title: z.string().optional(),
      days: z.coerce.number().int().min(1).max(30).optional(),
      hoursPerDay: z.coerce.number().int().min(1).max(16).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      missionId: z.string().optional(),
    })
    .optional(),
});

export const confirmPlanSchema = planSchema.extend({
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  color: z.string().default('#7C5CFF'),
  missionId: z.string().optional(),
  runwayTitle: z.string().optional(),
});

export { planSchema, planStepSchema, planDaySchema };
