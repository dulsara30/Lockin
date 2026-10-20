import { Metadata } from 'next';
import { Suspense } from 'react';
import { BrainDumpView } from '@/features/brain-dump/components/brain-dump-view';

export const metadata: Metadata = {
  title: 'Brain Dump to Plan | Lockin',
  description:
    'Turn your chaotic thoughts or markdown checklists into an actionable multi-day execution runway.',
};

export default function BrainDumpPage() {
  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <Suspense fallback={<div className="h-40 rounded-2xl bg-surface/30 animate-pulse" />}>
        <BrainDumpView />
      </Suspense>
    </div>
  );
}
