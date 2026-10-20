import { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { getStepById } from '@/server/dal/steps';
import { getMissionById } from '@/server/dal/missions';
import { LockinModeView } from '@/features/lockin/components/lockin-mode-view';

export const metadata: Metadata = { title: 'Lock-In Mode' };

interface LockinPageProps {
  searchParams: Promise<{ stepId?: string; missionId?: string }>;
}

export default async function LockinPage({ searchParams }: LockinPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { stepId, missionId } = await searchParams;
  let stepData = null;

  if (stepId) {
    const [step, mission] = await Promise.all([
      getStepById(userId, stepId),
      missionId ? getMissionById(userId, missionId) : Promise.resolve(null),
    ]);

    if (step) {
      stepData = {
        ...JSON.parse(JSON.stringify(step)),
        missionTitle: mission?.title,
        missionColor: mission?.color,
      };
    }
  }

  return (
    <Suspense fallback={null}>
      <LockinModeView step={stepData} />
    </Suspense>
  );
}
