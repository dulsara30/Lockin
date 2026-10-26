'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { EXPORT_FORMATS, renderExport } from '@/lib/export/runway-export';
import { loadExportDoc } from '@/server/export/runway-doc';

const exportSchema = z.object({
  runwayId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid runway'),
  dayIndex: z.number().int().min(0).max(29).optional(),
  format: z.enum(EXPORT_FORMATS),
});

export type ExportRunwayInput = z.input<typeof exportSchema>;

/**
 * Export a whole runway (all days) or a single day. Any member, including view-only,
 * may export what they can see.
 */
export async function actionExportRunway(raw: ExportRunwayInput) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false as const, error: 'Unauthorized' };

  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: 'Invalid export request' };
  const { runwayId, dayIndex, format } = parsed.data;

  try {
    const limit = await checkRateLimit(`export:${userId}`, 30, 60);
    if (!limit.success) {
      return { success: false as const, error: 'Too many exports. Try again in a minute.' };
    }

    const doc = await loadExportDoc(userId, runwayId, dayIndex);
    return { success: true as const, ...renderExport(doc, format) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      success: false as const,
      error: /not found|permission/i.test(message) ? message : 'Export failed',
    };
  }
}
