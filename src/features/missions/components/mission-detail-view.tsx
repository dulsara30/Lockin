'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Route,
  Plus,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  Target,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  actionGetMissionDetails,
  actionUpdateMission,
  actionDeleteMission,
} from '@/features/missions/actions';
import { actionCreateRunway, actionDeleteRunway } from '@/features/runway/actions';
import { toast } from 'sonner';

interface MissionDetailViewProps {
  missionId: string;
}

export function MissionDetailView({ missionId }: MissionDetailViewProps) {
  const router = useRouter();
  const [data, setData] = React.useState<{
    mission: any;
    runways: any[];
    steps: any[];
    insights: any;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showAddRunway, setShowAddRunway] = React.useState(false);
  const [newRunwayTitle, setNewRunwayTitle] = React.useState('');
  const [newRunwayDays, setNewRunwayDays] = React.useState(5);
  const [isCreatingRunway, setIsCreatingRunway] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    const res = await actionGetMissionDetails(missionId);
    if (res.success && res.data) {
      setData(res.data);
      setNewRunwayTitle((prev) => prev || `${res.data.mission.title} Sprint`);
    } else {
      toast.error(res.error || 'Failed to load mission');
    }
    setIsLoading(false);
  }, [missionId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async () => {
    if (!data) return;
    const nextStatus = data.mission.status === 'completed' ? 'active' : 'completed';
    const res = await actionUpdateMission(missionId, { status: nextStatus });
    if (res.success) {
      toast.success(`Mission marked as ${nextStatus}`);
      setData((prev) =>
        prev ? { ...prev, mission: { ...prev.mission, status: nextStatus } } : prev
      );
    } else {
      toast.error('Failed to update status');
    }
  };

  const handleCreateRunway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunwayTitle.trim()) {
      toast.error('Runway title is required');
      return;
    }

    setIsCreatingRunway(true);
    const res = await actionCreateRunway({
      missionId,
      title: newRunwayTitle.trim(),
      dayCount: Number(newRunwayDays),
    });
    setIsCreatingRunway(false);

    if (res.success && res.data) {
      toast.success('Runway created under this mission!');
      setShowAddRunway(false);
      setNewRunwayTitle('');
      loadData();
      router.push(`/runway?missionId=${missionId}&runwayId=${res.data._id}`);
    } else {
      toast.error(res.error || 'Failed to create runway');
    }
  };

  const handleDeleteRunway = async (runwayId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this runway and its steps?')) return;
    const res = await actionDeleteRunway(runwayId);
    if (res.success) {
      toast.success('Runway deleted');
      loadData();
    } else {
      toast.error('Failed to delete runway');
    }
  };

  const handleDeleteMission = async () => {
    if (!confirm('Delete this entire mission and all of its runways? This cannot be undone.'))
      return;
    const res = await actionDeleteMission(missionId);
    if (res.success) {
      toast.success('Mission deleted');
      router.push('/missions');
    } else {
      toast.error('Failed to delete mission');
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-surface/50 rounded-xl" />
        <div className="h-44 bg-surface/40 rounded-2xl border border-border" />
        <div className="h-64 bg-surface/40 rounded-2xl border border-border" />
      </div>
    );
  }

  const { mission, runways, steps, insights } = data;
  const completedSteps = steps.filter((s) => s.status === 'done').length;
  const completionPct = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
  const totalPlannedHours =
    Math.round((steps.reduce((acc, s) => acc + (s.estimateMin || 0), 0) / 60) * 10) / 10;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link href="/missions">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: mission.color || '#7C5CFF' }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mission Details & Runways
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {mission.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/insights?missionId=${mission._id}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-border">
              <BarChart2 className="h-3.5 w-3.5 text-cyan" />
              <span>Mission Insights</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={`text-xs gap-1.5 ${
              mission.status === 'completed'
                ? 'border-lime/40 text-lime bg-lime/10'
                : 'border-border text-muted-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{mission.status === 'completed' ? 'Completed' : 'Mark Complete'}</span>
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteMission}
            className="text-xs gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Mission Summary & Insights Strip */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
        {mission.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{mission.description}</p>
        )}

        {mission.tags && mission.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {mission.tags.map((tag: string, i: number) => (
              <span
                key={i}
                className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Per-Mission Insights Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/50">
          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Mission Progress</span>
            <div className="flex items-center gap-2 font-mono font-bold text-foreground text-lg">
              <CheckCircle2 className="h-4 w-4 text-lime" />
              <span>{completionPct}%</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {completedSteps} / {steps.length} tasks done
            </span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Planned Workload</span>
            <div className="flex items-center gap-2 font-mono font-bold text-foreground text-lg">
              <Clock className="h-4 w-4 text-info" />
              <span>{totalPlannedHours} hrs</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Across all runways
            </span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Runways Count</span>
            <div className="flex items-center gap-2 font-mono font-bold text-foreground text-lg">
              <Route className="h-4 w-4 text-primary" />
              <span>{runways.length}</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Under this mission
            </span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Priority</span>
            <div className="flex items-center gap-2 font-semibold capitalize text-foreground text-base">
              <span className="text-xs px-2 py-0.5 rounded bg-muted border border-border font-mono uppercase">
                {mission.priority}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Due {new Date(mission.deadline).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Runways Section (A runway cannot exist without a mission) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              <span>Runways Under This Mission</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Sequenced day-by-day execution pipelines for this mission.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/brain-dump`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan" />
                <span>AI Brain Dump</span>
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => setShowAddRunway((prev) => !prev)}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddRunway ? 'Cancel' : 'Create Runway'}</span>
            </Button>
          </div>
        </div>

        {/* Inline Create Runway Form */}
        {showAddRunway && (
          <form
            onSubmit={handleCreateRunway}
            className="p-5 rounded-2xl border border-primary/40 bg-surface shadow-xl space-y-4 animate-in fade-in"
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Initialize New Runway for &ldquo;{mission.title}&rdquo;</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rTitle" className="text-xs">
                  Runway Name
                </Label>
                <Input
                  id="rTitle"
                  required
                  placeholder="e.g. Sprint 1, Launch Week, Core Build"
                  value={newRunwayTitle}
                  onChange={(e) => setNewRunwayTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rDays" className="text-xs">
                  Duration (Days)
                </Label>
                <Input
                  id="rDays"
                  type="number"
                  min={1}
                  max={30}
                  value={newRunwayDays}
                  onChange={(e) =>
                    setNewRunwayDays(Math.max(1, Math.min(30, Number(e.target.value))))
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddRunway(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingRunway}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-medium"
              >
                {isCreatingRunway ? 'Creating...' : 'Create Runway & Open'}
              </Button>
            </div>
          </form>
        )}

        {/* Runways List */}
        {runways.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-10 text-center">
            <Route className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-foreground">No runways created yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-5">
              This mission can live without a runway, but creating a runway unlocks sequenced daily
              breakdowns, drag-and-drop planning, and capacity estimation.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => setShowAddRunway(true)}
                className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Runway</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runways.map((runway) => {
              const rSteps = steps.filter((s) => s.runwayId?.toString() === runway._id.toString());
              const rDone = rSteps.filter((s) => s.status === 'done').length;
              const rPct = rSteps.length > 0 ? Math.round((rDone / rSteps.length) * 100) : 0;

              return (
                <div
                  key={runway._id}
                  className="group relative rounded-2xl border border-border bg-surface p-5 shadow-lg hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {runway.title}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRunway(runway._id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-danger rounded transition-opacity"
                        title="Delete Runway"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{runway.dayCount} Days</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-lime" />
                        <span>
                          {rDone}/{rSteps.length} Done
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-background h-1.5 rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${rPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {rPct}% complete
                    </span>
                    <Link href={`/runway?missionId=${mission._id}&runwayId=${runway._id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1 text-primary hover:text-primary-hover hover:bg-primary/10 h-7 px-2.5"
                      >
                        <span>Open Runway</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
