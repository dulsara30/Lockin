import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { actionGetMissions } from '@/features/missions/actions';
import { getMissionById } from '@/server/dal/missions';
import { getRunwayByMission, getRunwaysByMission, getRunwayById } from '@/server/dal/runways';
import { getStepsByMission } from '@/server/dal/steps';
import { getUserSettings } from '@/server/dal/settings';
import { RunwayPipeline } from '@/features/runway/components/runway-pipeline';
import { RunwayMissionSelector } from '@/features/runway/components/runway-mission-selector';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Route, Target, Sparkles, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Runway',
};

interface RunwayPageProps {
  searchParams: Promise<{ missionId?: string; runwayId?: string }>;
}

export default async function RunwayPage({ searchParams }: RunwayPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const resolvedParams = await searchParams;
  const [missionsRes, settings] = await Promise.all([actionGetMissions(), getUserSettings(userId)]);
  const missions = missionsRes.success && missionsRes.data ? missionsRes.data : [];
  const dailyCapacityMin = (settings.workHoursPerDay || 8) * 60;

  // Case 1: No mission selected -> Show Missions Card View with KPIs
  if (!resolvedParams.missionId) {
    return <RunwayMissionSelector missions={missions} />;
  }

  // Case 2: Mission selected -> Find mission
  const activeMission = await getMissionById(userId, resolvedParams.missionId);
  if (!activeMission) {
    return <RunwayMissionSelector missions={missions} />;
  }

  // Get all runways/versions for this mission
  const runwaysList = await getRunwaysByMission(userId, activeMission._id.toString());

  // Determine current active or selected runway
  let runway = null;
  if (resolvedParams.runwayId) {
    runway = await getRunwayById(userId, resolvedParams.runwayId);
  }
  if (!runway) {
    runway = runwaysList.find((r) => r.isActive) || runwaysList[runwaysList.length - 1] || null;
  }

  // Case 3: Selected mission has no runway yet
  if (!runway) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <Link href="/runway">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {activeMission.title}
            </h1>
            <p className="text-xs text-muted-foreground">Runway Pipeline</p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
            <Route className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            No runway created for &ldquo;{activeMission.title}&rdquo;
          </h3>
          <p className="text-xs text-muted-foreground mt-1 mb-6">
            A runway cannot exist without a mission. This mission is active, but you have not yet
            initialized its execution runway.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={`/missions/${activeMission._id}`}>
              <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-2 shadow-md shadow-primary/25">
                <Plus className="h-4 w-4" />
                <span>Create Runway for this Mission</span>
              </Button>
            </Link>
            <Link href={`/brain-dump?missionId=${activeMission._id}`}>
              <Button variant="outline" className="text-xs gap-1.5 border-border bg-surface">
                <Sparkles className="h-3.5 w-3.5 text-cyan" />
                <span>AI Brain Dump</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Runway exists -> Load its steps and render the pipeline
  const steps = await getStepsByMission(userId, activeMission._id.toString());

  return (
    <div className="space-y-6">
      <RunwayPipeline
        mission={JSON.parse(JSON.stringify(activeMission))}
        runway={JSON.parse(JSON.stringify(runway))}
        runwaysList={JSON.parse(JSON.stringify(runwaysList))}
        initialSteps={JSON.parse(JSON.stringify(steps))}
        missionsList={JSON.parse(JSON.stringify(missions))}
        dailyCapacityMin={dailyCapacityMin}
      />
    </div>
  );
}
