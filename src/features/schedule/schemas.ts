import { z } from 'zod';
import { isYmd } from '@/lib/calendar';

export const ymdSchema = z.string().refine(isYmd, 'Use a valid date (YYYY-MM-DD)');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

/** Optional scheduling fields accepted wherever a mission or runway is created. */
export const scheduleFields = {
  startOn: ymdSchema.optional(),
  endOn: ymdSchema.optional(),
  workingWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  skipDates: z.array(ymdSchema).max(60).optional(),
};

export const startRunwaySchema = z.object({
  runwayId: objectId,
  startOn: ymdSchema.optional(),
  dryRun: z.boolean().optional(),
});

export const shiftRunwaySchema = z.object({
  runwayId: objectId,
  startOn: ymdSchema,
  dryRun: z.boolean().optional(),
});

export const postponeSchema = z.object({
  runwayId: objectId,
  fromDay: z.number().int().min(0).max(29),
  days: z.number().int().min(1).max(30),
  dryRun: z.boolean().optional(),
});

export const workingDaysSchema = z.object({
  runwayId: objectId,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  dryRun: z.boolean().optional(),
});

export const skipDatesSchema = z.object({
  runwayId: objectId,
  add: z.array(ymdSchema).max(60).default([]),
  remove: z.array(ymdSchema).max(60).default([]),
  dryRun: z.boolean().optional(),
});
