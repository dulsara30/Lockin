'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Target,
  Route,
  Sparkles,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Clock,
  Plus,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { actionUpdateMission, actionDeleteMission } from '@/features/missions/actions';
import { actionCreateRunway, actionDeleteRunway } from '@/features/runway/actions';
import { toast } from 'sonner';

const paletteColors = [
  '#7C5CFF', // Violet
  '#2DE2E6', // Cyan
  '#C6FF3D', // Lime
  '#FFB020', // Amber
  '#FF5D73', // Coral
  '#FF61D2', // Pink
  '#38EF7D', // Emerald
];

export interface MissionWithRunway {
  _id: string;
  title: string;
  description?: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dayCount: number;
  startDate: string;
  deadline: string;
  status: string;
  tags?: string[];
  hasRunway?: boolean;
  runway?: {
    _id: string;
    title: string;
    dayCount: number;
    startDate?: string;
    deadline?: string;
  } | null;
  stepCount?: number;
  completedStepCount?: number;
  completionRatePercent?: number;
  totalEstimateMin?: number;
  completedEstimateMin?: number;
  health?: string;
}

interface MissionModalProps {
  mission: MissionWithRunway | null;
  isOpen: boolean;
  onClose: () => void;
  onMissionUpdated: () => void;
  onMissionDeleted: (missionId: string) => void;
}

export function MissionModal({
  mission,
  isOpen,
  onClose,
  onMissionUpdated,
  onMissionDeleted,
}: MissionModalProps) {
  const router = useRouter();

  // Form edit states
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#7C5CFF');
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dayCount, setDayCount] = React.useState(5);
  const [tags, setTags] = React.useState('');
  const [status, setStatus] = React.useState<'active' | 'completed' | 'archived'>('active');

  // Runway creation state
  const [showCreateRunway, setShowCreateRunway] = React.useState(false);
  const [runwayTitle, setRunwayTitle] = React.useState('');
  const [runwayDays, setRunwayDays] = React.useState(5);
  const [isCreatingRunway, setIsCreatingRunway] = React.useState(false);

  // Loading states
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Sync state when mission changes
  React.useEffect(() => {
    if (mission) {
      setTitle(mission.title || '');
      setDescription(mission.description || '');
      setColor(mission.color || '#7C5CFF');
      setPriority((mission.priority as any) || 'medium');
      setDayCount(mission.dayCount || 5);
      setTags(mission.tags?.join(', ') || '');
      setStatus((mission.status as any) || 'active');
      setRunwayTitle(`${mission.title} Runway`);
      setRunwayDays(mission.dayCount || 5);
      setShowCreateRunway(false);
      setShowDeleteConfirm(false);
    }
  }, [mission]);

  if (!mission) return null;

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Mission title is required');
      return;
    }

    setIsSaving(true);
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await actionUpdateMission(mission._id, {
      title: title.trim(),
      description: description.trim(),
      color,
      priority,
      dayCount: Number(dayCount),
      status,
      tags: parsedTags,
    });
    setIsSaving(false);

    if (res.success) {
      toast.success('Mission updated successfully');
      onMissionUpdated();
      onClose();
    } else {
      toast.error(res.error || 'Failed to update mission');
    }
  };

  const handleCreateRunway = async () => {
    if (!runwayTitle.trim()) {
      toast.error('Runway title is required');
      return;
    }

    setIsCreatingRunway(true);
    const res = await actionCreateRunway({
      missionId: mission._id,
      title: runwayTitle.trim(),
      dayCount: Number(runwayDays),
    });
    setIsCreatingRunway(false);

    if (res.success && res.data) {
      toast.success('Runway created! Directing to pipeline...');
      onMissionUpdated();
      onClose();
      router.push(`/runway?missionId=${mission._id}&runwayId=${res.data._id}`);
    } else {
      toast.error(res.error || 'Failed to create runway');
    }
  };

  const handleDeleteRunway = async () => {
    if (!mission.runway?._id) return;
    if (
      !confirm(
        'Are you sure you want to delete this runway and all its steps? The mission will remain.'
      )
    ) {
      return;
    }

    const res = await actionDeleteRunway(mission.runway._id);
    if (res.success) {
      toast.success('Runway deleted from mission');
      onMissionUpdated();
    } else {
      toast.error('Failed to delete runway');
    }
  };

  const handleDeleteMission = async () => {
    setIsDeleting(true);
    const res = await actionDeleteMission(mission._id);
    setIsDeleting(false);

    if (res.success) {
      toast.success('Mission and its runway deleted');
      onMissionDeleted(mission._id);
      onClose();
    } else {
      toast.error(res.error || 'Failed to delete mission');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-surface border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Mission Overview & Configuration
            </span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {mission.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Edit mission settings, manage its execution runway, or track progress.
          </DialogDescription>
        </DialogHeader>

        {showDeleteConfirm ? (
          /* Confirmation dialog for deleting mission */
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Delete Entire Mission & Runway?</p>
                <p className="text-xs text-danger/80 mt-1 leading-relaxed">
                  This action will permanently delete mission &ldquo;{mission.title}&rdquo; and its
                  belonging runway pipeline and all steps. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteMission}
                className="text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Permanent Deletion'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveMission} className="space-y-5 py-2">
            {/* Title & Description */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="mTitle" className="text-xs">
                  Mission Title
                </Label>
                <Input
                  id="mTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="text-sm font-semibold mt-1"
                />
              </div>

              <div>
                <Label htmlFor="mDesc" className="text-xs">
                  Description / Objectives
                </Label>
                <textarea
                  id="mDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full mt-1 rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
                  placeholder="Strategic mission notes and goals..."
                />
              </div>
            </div>

            {/* Priority & Status & Days */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground capitalize font-medium focus:outline-none focus:border-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground capitalize font-medium focus:outline-none focus:border-primary"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <Label htmlFor="mDays" className="text-xs">
                  Timeline (Days)
                </Label>
                <Input
                  id="mDays"
                  type="number"
                  min={1}
                  max={365}
                  value={dayCount}
                  onChange={(e) => setDayCount(Math.max(1, Number(e.target.value)))}
                  className="font-mono text-xs mt-1"
                />
              </div>
            </div>

            {/* Color Accent */}
            <div>
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2.5 mt-1.5">
                {paletteColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      color === c
                        ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-background'
                        : 'opacity-70 hover:opacity-100 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="mTags" className="text-xs">
                Tags (comma-separated)
              </Label>
              <Input
                id="mTags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="dev, client, product, launch"
                className="text-xs mt-1"
              />
            </div>

            {/* Runway Section (1 Mission = 1 Runway maximum) */}
            <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Route className="h-4 w-4 text-primary" />
                  <span>Mission Runway Pipeline</span>
                </span>

                {mission.hasRunway ? (
                  <span className="text-[11px] font-semibold text-lime px-2 py-0.5 rounded-full bg-lime/10 border border-lime/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Runway Configured</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
                    No runway yet
                  </span>
                )}
              </div>

              {mission.hasRunway && mission.runway ? (
                <div className="p-3 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">{mission.runway.title}</p>
                    <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                      <span>{mission.runway.dayCount} Days</span>
                      <span>•</span>
                      <span>
                        {mission.completedStepCount ?? 0}/{mission.stepCount ?? 0} tasks done
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleDeleteRunway}
                      className="text-xs h-8 px-2.5"
                      title="Delete Runway"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete Runway</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onClose();
                        router.push(`/runway?missionId=${mission._id}`);
                      }}
                      className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 h-8 px-3.5 shadow-sm"
                    >
                      <span>Go to Runway</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A mission can live on its own, but you can create a runway to schedule and
                    drag-and-drop daily steps.
                  </p>

                  {showCreateRunway ? (
                    <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px]">Runway Name</Label>
                          <Input
                            value={runwayTitle}
                            onChange={(e) => setRunwayTitle(e.target.value)}
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Runway Length (Days)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={runwayDays}
                            onChange={(e) =>
                              setRunwayDays(Math.max(1, Math.min(30, Number(e.target.value))))
                            }
                            className="font-mono text-xs mt-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateRunway(false)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isCreatingRunway}
                          onClick={handleCreateRunway}
                          className="bg-primary hover:bg-primary-hover text-white text-xs"
                        >
                          {isCreatingRunway ? 'Creating...' : 'Initialize Runway'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowCreateRunway(true)}
                        className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Quick Create Runway</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onClose();
                          router.push(`/brain-dump?missionId=${mission._id}`);
                        }}
                        className="text-xs gap-1.5 border-border bg-background hover:bg-surface"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-cyan" />
                        <span>Create via AI Brain Dump</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <DialogFooter className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs gap-1.5 self-start sm:self-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Mission</span>
              </Button>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
