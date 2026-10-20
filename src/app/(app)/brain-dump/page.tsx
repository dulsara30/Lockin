import { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { getUserSettings } from '@/server/dal/settings';
import { BrainDumpView } from '@/features/brain-dump/components/brain-dump-view';

export const metadata: Metadata = {
  title: 'Brain Dump to Plan | Lockin',
  description:
    'Turn your chaotic thoughts or markdown checklists into an actionable multi-day execution runway.',
};

export default async function BrainDumpPage() {
  const session = await auth();
  const userId = session?.user?.id;
  let workHoursPerDay = 8;

  if (userId) {
    try {
      const settings = await getUserSettings(userId);
      if (settings?.workHoursPerDay) {
        workHoursPerDay = settings.workHoursPerDay;
      }
    } catch {
      // Fallback
    }
  }

  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <Suspense fallback={<div className="h-40 rounded-2xl bg-surface/30 animate-pulse" />}>
        <BrainDumpView defaultHoursPerDay={workHoursPerDay} />
      </Suspense>
    </div>
  );
}
