import { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { getStepById } from '@/server/dal/steps';
import { getMissionById } from '@/server/dal/missions';
import { requireStepAccess } from '@/server/dal/access';
import { canEdit } from '@/lib/access';
import { LockinModeView } from '@/features/lockin/components/lockin-mode-view';

export const metadata: Metadata = { title: 'Lock-In Mode' };

interface LockinPageProps {
  searchParams: Promise<{ stepId?: string; missionId?: string }>;
}

export default async function LockinPage({ searchParams }: LockinPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { stepId } = await searchParams;
  let stepData = null;
  let readOnly = false;

  if (stepId) {
    try {
      // Resolve the step through the access layer; works for owned and shared missions
      const access = await requireStepAccess(userId, stepId, 'viewer');
      const [step, mission] = await Promise.all([
        getStepById(access.ownerId, stepId),
        getMissionById(access.ownerId, access.stepMissionId),
      ]);

      if (step) {
        readOnly = !canEdit(access.role);
        stepData = {
          ...JSON.parse(JSON.stringify(step)),
          missionTitle: mission?.title,
          missionColor: mission?.color,
        };
      }
    } catch {
      stepData = null;
    }
  }

  return (
    <Suspense fallback={null}>
      <LockinModeView step={stepData} readOnly={readOnly} />
    </Suspense>
  );
}
