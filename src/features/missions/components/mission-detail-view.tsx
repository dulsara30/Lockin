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
  Edit3,
  FileCode,
  X,
  Save,
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

  // Edit Mission State
  const [isEditingMission, setIsEditingMission] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [editDeadline, setEditDeadline] = React.useState('');
  const [editColor, setEditColor] = React.useState('#7C5CFF');
  const [isSavingMission, setIsSavingMission] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    const res = await actionGetMissionDetails(missionId);
    if (res.success && res.data) {
      setData(res.data);
      setNewRunwayTitle((prev) => prev || `${res.data.mission.title} Sprint`);
      setEditTitle(res.data.mission.title);
      setEditDescription(res.data.mission.description || '');
      setEditPriority(res.data.mission.priority || 'medium');
      setEditColor(res.data.mission.color || '#7C5CFF');
      if (res.data.mission.deadline) {
        setEditDeadline(new Date(res.data.mission.deadline).toISOString().split('T')[0]);
      }
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

  const handleSaveMissionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSavingMission(true);
    const res = await actionUpdateMission(missionId, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      color: editColor,
      deadline: editDeadline ? new Date(editDeadline) : undefined,
    });
    setIsSavingMission(false);

    if (res.success && res.data) {
      toast.success('Mission updated successfully');
      setIsEditingMission(false);
      setData((prev) => (prev ? { ...prev, mission: { ...prev.mission, ...res.data } } : prev));
    } else {
      toast.error(res.error || 'Failed to update mission');
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
      toast.error(res.error || 'Failed to delete runway');
    }
  };

  const handleDeleteMission = async () => {
    if (!confirm('Delete this entire mission and its runway? This cannot be undone.')) return;
    const res = await actionDeleteMission(missionId);
    if (res.success) {
      toast.success('Mission and runway deleted');
      router.push('/missions');
    } else {
      toast.error(res.error || 'Failed to delete mission');
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

  const { mission, runways, steps } = data;
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
                Mission Details & Execution Runway
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {mission.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditingMission((prev) => !prev)}
            className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
          >
            {isEditingMission ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Edit3 className="h-3.5 w-3.5 text-primary" />
            )}
            <span>{isEditingMission ? 'Cancel Edit' : 'Edit Mission'}</span>
          </Button>

          <Link href={`/insights?missionId=${mission._id}`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
            >
              <BarChart2 className="h-3.5 w-3.5 text-cyan" />
              <span>Insights</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={`text-xs gap-1.5 ${
              mission.status === 'completed'
                ? 'border-lime/40 text-lime bg-lime/10'
                : 'border-border text-muted-foreground bg-surface hover:bg-surface-hover'
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

      {/* Inline Mission Edit Form */}
      {isEditingMission && (
        <form
          onSubmit={handleSaveMissionEdit}
          className="rounded-2xl border border-primary/40 bg-surface p-6 shadow-xl space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              <span>Edit Mission Configuration</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsEditingMission(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Mission Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title..."
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Deadline</Label>
              <Input
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <textarea
              value={editDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditDescription(e.target.value)
              }
              placeholder="What is this mission about?"
              rows={2}
              className="flex w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority(p)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all ${
                      editPriority === p
                        ? 'border-primary bg-primary/20 text-foreground'
                        : 'border-border bg-surface-hover/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Color Tag</Label>
              <div className="flex items-center gap-2 pt-1">
                {['#7C5CFF', '#2DE2E6', '#C6FF3D', '#FFB020', '#FF5D73', '#FF61D2'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      editColor === c
                        ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingMission(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSavingMission}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 font-medium"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSavingMission ? 'Saving...' : 'Save Mission'}</span>
            </Button>
          </div>
        </form>
      )}

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
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Execution runway</span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Runway Status</span>
            <div className="flex items-center gap-2 font-mono font-bold text-foreground text-base">
              <Route className="h-4 w-4 text-primary" />
              <span>{runways.length > 0 ? 'Active' : 'None'}</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {runways.length > 0 ? runways[0].title : 'Awaiting plan'}
            </span>
          </div>

          <div className="bg-background/80 p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Priority</span>
            <div className="flex items-center gap-2 font-semibold capitalize text-foreground text-base">
              <span className="text-xs px-2 py-0.5 rounded bg-muted border border-border font-mono uppercase">
                {mission.priority}
              </span>
            </div>
            <span
              suppressHydrationWarning
              className="text-[10px] text-muted-foreground mt-0.5 block"
            >
              Due {new Date(mission.deadline).toISOString().split('T')[0]}
            </span>
          </div>
        </div>
      </div>

      {/* Runway Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              <span>Mission Runway</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Sequenced day-by-day execution pipeline for &ldquo;{mission.title}&rdquo;.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {runways.length === 0 ? (
              <>
                <Link href={`/brain-dump?missionId=${mission._id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan" />
                    <span>Plan with AI</span>
                  </Button>
                </Link>

                <Link href={`/brain-dump?missionId=${mission._id}&tab=template`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
                  >
                    <FileCode className="h-3.5 w-3.5 text-primary" />
                    <span>Import Template</span>
                  </Button>
                </Link>

                <Button
                  size="sm"
                  onClick={() => setShowAddRunway((prev) => !prev)}
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showAddRunway ? 'Cancel' : 'Quick Create'}</span>
                </Button>
              </>
            ) : (
              <Link href={`/runway?missionId=${mission._id}&runwayId=${runways[0]._id}`}>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20"
                >
                  <Route className="h-3.5 w-3.5" />
                  <span>Open Pipeline View</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Inline Quick Create Runway Form */}
        {showAddRunway && runways.length === 0 && (
          <form
            onSubmit={handleCreateRunway}
            className="p-5 rounded-2xl border border-primary/40 bg-surface shadow-xl space-y-4 animate-in fade-in"
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Initialize Runway Pipeline for &ldquo;{mission.title}&rdquo;</span>
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

        {/* Runways Display */}
        {runways.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-10 text-center">
            <Route className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-foreground">
              No runway created yet for this mission
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-6">
              A mission can live without a runway, but creating one unlocks sequenced daily
              breakdowns, drag-and-drop planning, time tracking, and capacity forecasting.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`/brain-dump?missionId=${mission._id}`}>
                <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Break Down with AI</span>
                </Button>
              </Link>
              <Link href={`/brain-dump?missionId=${mission._id}&tab=template`}>
                <Button
                  variant="outline"
                  className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
                >
                  <FileCode className="h-3.5 w-3.5 text-primary" />
                  <span>Use Template / JSON</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setShowAddRunway(true)}
                className="text-xs gap-1.5 border-border bg-surface text-foreground hover:bg-surface-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Manual Setup</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                          Active Pipeline
                        </span>
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mt-0.5">
                          {runway.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRunway(runway._id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-danger rounded transition-opacity"
                        title="Delete Runway"
                      >
                        <Trash2 className="h-4 w-4" />
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
                    <div className="w-full bg-background h-2 rounded-full overflow-hidden border border-border">
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
                        className="text-xs gap-1 text-primary hover:text-primary-hover hover:bg-primary/10 h-8 px-3"
                      >
                        <span>Open Pipeline</span>
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
