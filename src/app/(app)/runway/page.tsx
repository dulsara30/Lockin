import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getMissions, getMissionById } from '@/server/dal/missions';
import { getStepsByMission } from '@/server/dal/steps';
import { RunwayPipeline } from '@/features/runway/components/runway-pipeline';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Route, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Runway',
};

interface RunwayPageProps {
  searchParams: Promise<{ missionId?: string }>;
}

export default async function RunwayPage({ searchParams }: RunwayPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const resolvedParams = await searchParams;
  const missions = await getMissions(userId);

  if (!missions || missions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Runway</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-day pipeline & capacity visualizer
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
            <Route className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No active runway found</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-6">
            Initialize a mission to unlock your sequenced pipeline with drag-and-drop days and
            workload capacity tracking.
          </p>
          <Link href="/missions/new">
            <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-2 shadow-md shadow-primary/25">
              <Plus className="h-4 w-4" />
              <span>Create Your First Mission</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Selected mission
  const activeMissionId = resolvedParams.missionId || missions[0]._id.toString();
  const currentMission = missions.find((m) => m._id.toString() === activeMissionId) || missions[0];

  const steps = await getStepsByMission(userId, currentMission._id.toString());

  return (
    <div className="space-y-6">
      <RunwayPipeline
        mission={JSON.parse(JSON.stringify(currentMission))}
        initialSteps={JSON.parse(JSON.stringify(steps))}
        missionsList={JSON.parse(JSON.stringify(missions))}
      />
    </div>
  );
}
