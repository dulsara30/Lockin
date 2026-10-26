'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { generateKeyBetween } from 'fractional-indexing';
import { RunwayDayColumn } from './runway-day-column';
import { RunwayStepCard } from './runway-step-card';
import { StepDrawer, StepData } from '@/features/steps/components/step-drawer';
import { RolloverModal } from './rollover-modal';
import { ReplanModal } from './replan-modal';
import { ConfirmStartDayModal } from './confirm-start-day-modal';
import { calculateMissionHealth, MissionHealthResult } from '@/lib/planning';
import {
  actionCreateStep,
  actionReorderStep,
  actionUpdateStep,
  actionQuickReorderStep,
  actionQuickUpdateStepStatus,
} from '@/features/missions/actions';
import {
  actionDeleteRunway,
  actionStartDay,
  actionSwitchActiveRunway,
} from '@/features/runway/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RotateCw,
  Plus,
  Sparkles,
  Route,
  ChevronDown,
  Info,
  Calendar,
  Download,
  LayoutTemplate,
  Target,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  Trash2,
  FileText,
} from 'lucide-react';
import { saveMissionAsTemplateAction } from '@/features/templates/actions';
import { ExportMenu } from '@/features/export/components/export-menu';
import { toast } from 'sonner';
import { canEdit, MissionRole } from '@/lib/access';

export interface MissionData {
  _id: string;
  title: string;
  description?: string;
  color: string;
  priority: string;
  dayCount: number;
  startDate: string;
  deadline: string;
  status: string;
}

export interface RunwayData {
  _id: string;
  title: string;
  dayCount: number;
  startDate?: string;
  deadline?: string;
  status?: string;
  version?: number;
  isOriginal?: boolean;
  isActive?: boolean;
  dayStartTimes?: Record<string, string>;
  dayFailedIndices?: number[];
}

interface RunwayPipelineProps {
  mission: MissionData;
  runway?: RunwayData;
  runwaysList?: RunwayData[];
  initialSteps: StepData[];
  missionsList?: MissionData[];
  dailyCapacityMin?: number;
  role?: MissionRole;
}

function safeOrderBetween(
  prev: string | null | undefined,
  next: string | null | undefined
): string {
  try {
    if (prev && next && prev.localeCompare(next) >= 0) {
      return generateKeyBetween(next || null, null);
    }
    return generateKeyBetween(prev || null, next || null);
  } catch {
    return `${prev || 'a0'}m`;
  }
}

export function RunwayPipeline({
  mission,
  runway,
  runwaysList = [],
  initialSteps,
  missionsList = [],
  dailyCapacityMin = 240,
  role = 'owner',
}: RunwayPipelineProps) {
  const router = useRouter();
  const readOnly = !canEdit(role);
  const [steps, setSteps] = React.useState<StepData[]>(initialSteps);
  const [activeStep, setActiveStep] = React.useState<StepData | null>(null);
  const [selectedStep, setSelectedStep] = React.useState<StepData | null>(null);
  const [confirmStartDayIndex, setConfirmStartDayIndex] = React.useState<number | null>(null);
  const [dayStartTimes, setDayStartTimes] = React.useState<Record<string, string>>(
    (runway?.dayStartTimes as Record<string, string>) || {}
  );
  const [failedIndices, setFailedIndices] = React.useState<number[]>(
    runway?.dayFailedIndices || []
  );

  // Modals state
  const [isRolloverOpen, setIsRolloverOpen] = React.useState(false);
  const [isReplanOpen, setIsReplanOpen] = React.useState(false);
  const [isReplanConfirmOpen, setIsReplanConfirmOpen] = React.useState(false);
  const [isDeleteRunwayConfirmOpen, setIsDeleteRunwayConfirmOpen] = React.useState(false);
  const [isDeletingRunway, setIsDeletingRunway] = React.useState(false);

  const [currentDayIndex, setCurrentDayIndex] = React.useState(0);

  const effectiveDayCount = runway?.dayCount || mission.dayCount || 5;

  // Synchronize initial steps
  React.useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  // Compute current day index based on start date
  React.useEffect(() => {
    const startDateStr = runway?.startDate || mission.startDate;
    if (startDateStr) {
      const start = new Date(startDateStr).getTime();
      const now = new Date().getTime();
      const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      setCurrentDayIndex(Math.max(0, Math.min(effectiveDayCount - 1, diffDays)));
    }
  }, [runway?.startDate, mission.startDate, effectiveDayCount]);

  // Sensors for keyboard & pointer drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate pure health badge
  const health = calculateMissionHealth({
    steps,
    dayCount: effectiveDayCount,
    currentDayIndex,
    dailyCapacityMin,
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const step = steps.find((s) => s._id === active.id);
    if (step) setActiveStep(step);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Intentionally no state mutation during drag-over to prevent 60fps re-render loops and max update depth exceeded.
    // DragOverlay smoothly handles visual preview.
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStep(null);
    if (!over || readOnly) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = steps.find((s) => s._id === activeId);
    if (!activeItem) return;

    let targetDayIndex = activeItem.dayIndex;

    if (overId.startsWith('day-')) {
      const parsed = parseInt(overId.replace('day-column-', '').replace('day-', ''), 10);
      if (!isNaN(parsed)) targetDayIndex = parsed;
    } else {
      const overItem = steps.find((s) => s._id === overId);
      if (overItem) targetDayIndex = overItem.dayIndex;
    }

    const previousSteps = [...steps];

    // Exclude the item being moved to get true siblings
    const otherSteps = steps
      .filter((s) => s.dayIndex === targetDayIndex && s._id !== activeId)
      .sort((a, b) => (a.order || '').localeCompare(b.order || ''));

    let newOrder: string;
    if (otherSteps.length === 0) {
      newOrder = safeOrderBetween(null, null);
    } else {
      const overIndex = otherSteps.findIndex((s) => s._id === overId);
      if (overIndex === -1) {
        const last = otherSteps[otherSteps.length - 1];
        newOrder = safeOrderBetween(last ? last.order : null, null);
      } else {
        const prevOrder = overIndex > 0 ? otherSteps[overIndex - 1].order : null;
        const nextOrder = otherSteps[overIndex].order;
        newOrder = safeOrderBetween(prevOrder, nextOrder);
      }
    }

    // Optimistic update
    setSteps((prev) =>
      prev.map((s) =>
        s._id === activeId ? { ...s, dayIndex: targetDayIndex, order: newOrder } : s
      )
    );

    // Single write to database with optimistic rollback
    try {
      const res = await actionQuickReorderStep({
        stepId: activeId,
        newDayIndex: targetDayIndex,
        newOrder,
      });

      if (!res.success) {
        setSteps(previousSteps); // Rollback
        toast.error('Could not move task');
      }
    } catch {
      setSteps(previousSteps); // Rollback
      toast.error('Could not move task');
    }
  };

  const handleAddStepInline = async (dayIndex: number, title: string) => {
    const tempId = `temp-${Date.now()}`;
    const daySteps = steps
      .filter((s) => s.dayIndex === dayIndex)
      .sort((a, b) => a.order.localeCompare(b.order));
    const lastOrder = daySteps.length > 0 ? daySteps[daySteps.length - 1].order : null;
    const newOrder = generateKeyBetween(lastOrder, null);

    const optimisticStep: StepData = {
      _id: tempId,
      missionId: mission._id,
      dayIndex,
      order: newOrder,
      title,
      notes: '',
      estimateMin: 30,
      actualMin: 0,
      status: 'todo',
      checklist: [],
    };

    setSteps((prev) => [...prev, optimisticStep]);

    const res = await actionCreateStep({
      missionId: mission._id,
      runwayId: runway?._id,
      dayIndex,
      title,
      order: newOrder,
      estimateMin: 30,
      status: 'todo',
      notes: '',
      checklist: [],
    });

    if (res.success && res.data) {
      setSteps((prev) => prev.map((s) => (s._id === tempId ? res.data : s)));
      toast.success('Step added');
    } else {
      setSteps((prev) => prev.filter((s) => s._id !== tempId));
      toast.error('Failed to create step');
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      const res = await saveMissionAsTemplateAction(mission._id, mission.title);
      if (res.success) {
        toast.success('Mission runway saved as template!');
      } else {
        toast.error(res.error || 'Failed to save template');
      }
    } catch {
      toast.error('Error saving template');
    }
  };

  const handleExecuteDeleteRunway = async () => {
    if (!runway?._id) return;
    setIsDeletingRunway(true);
    try {
      const res = await actionDeleteRunway(runway._id);
      if (res.success) {
        toast.success('Runway and scheduled tasks deleted from mission.');
        setIsDeleteRunwayConfirmOpen(false);
        router.push(`/runway`);
      } else {
        toast.error(res.error || 'Failed to delete runway');
      }
    } catch {
      toast.error('Error deleting runway');
    } finally {
      setIsDeletingRunway(false);
    }
  };

  const handleQuickToggleStatus = async (stepId: string, currentStatus: StepData['status']) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const previousSteps = [...steps];
    setSteps((prev) => prev.map((s) => (s._id === stepId ? { ...s, status: newStatus } : s)));

    try {
      const res = await actionQuickUpdateStepStatus(stepId, newStatus);
      if (!res.success) {
        setSteps(previousSteps);
        toast.error('Failed to update status');
      }
    } catch {
      setSteps(previousSteps);
      toast.error('Failed to update status');
    }
  };

  const handleConfirmStartDay = async (dayIndex: number) => {
    if (!runway?._id) return;
    const nowIso = new Date().toISOString();
    setDayStartTimes((prev) => ({ ...prev, [dayIndex]: nowIso }));

    const res = await actionStartDay(runway._id, dayIndex);
    if (res.success) {
      toast.success(`Day ${dayIndex + 1} started! 24-hour completion clock active.`);
    } else {
      toast.error('Failed to start day clock.');
    }
  };

  const handleSwitchVersion = async (targetRunwayId: string) => {
    if (targetRunwayId === runway?._id) return;
    if (readOnly) {
      router.push(`/runway?missionId=${mission._id}&runwayId=${targetRunwayId}`);
      return;
    }
    try {
      const res = await actionSwitchActiveRunway(mission._id, targetRunwayId);
      if (res.success) {
        toast.success('Switched runway version');
        router.push(`/runway?missionId=${mission._id}&runwayId=${targetRunwayId}`);
      } else {
        toast.error('Failed to switch version');
      }
    } catch {
      toast.error('Error switching version');
    }
  };

  const getHealthBadge = (h: MissionHealthResult['health']) => {
    switch (h) {
      case 'On track':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success/20 text-success border border-success/30 shadow-sm shadow-success/10">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>On track</span>
          </span>
        );
      case 'At risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning/20 text-warning border border-warning/30 shadow-sm shadow-warning/10">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span>At risk</span>
          </span>
        );
      case 'Behind':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-danger/20 text-danger border border-danger/30 shadow-sm shadow-danger/10">
            <span className="h-2 w-2 rounded-full bg-danger" />
            <span>Behind schedule</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-info/20 text-info border border-info/30">
            <Sparkles className="h-3 w-3" />
            <span>Completed</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Mission Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-surface/70 border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/runway">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-surface"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All Missions Hub</span>
            </Button>
          </Link>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          {/* Mission Dropdown Switcher */}
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
              Mission:
            </span>
            <select
              value={mission._id}
              onChange={(e) => router.push(`/runway?missionId=${e.target.value}`)}
              className="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-primary cursor-pointer"
            >
              {missionsList.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Runway Version Switcher */}
          {runwaysList.length > 1 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border/80">
              <Route className="h-3.5 w-3.5 text-cyan shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                Runway:
              </span>
              <select
                value={runway?._id}
                onChange={(e) => handleSwitchVersion(e.target.value)}
                className="bg-background border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-cyan cursor-pointer"
              >
                {runwaysList.map((r, i) => (
                  <option key={r._id} value={r._id}>
                    {r.isOriginal ? 'v1 (Original)' : `v${r.version || i + 1} (Replan)`}
                    {r.isActive ? ' • Active' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/missions`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-border bg-background hover:bg-surface"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span>Manage Missions</span>
            </Button>
          </Link>

          {!readOnly && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteRunwayConfirmOpen(true)}
              className="text-xs gap-1.5"
              title="Delete this Runway"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Delete Runway</span>
            </Button>
          )}
        </div>
      </div>

      {/* Top Runway Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: mission.color || '#7C5CFF' }}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-lg">
              {runway?.title || `${mission.title} Runway`}
            </h1>
            {getHealthBadge(health.health)}
            {role !== 'owner' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-surface text-muted-foreground">
                {readOnly ? 'View only' : 'Editor'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>
              Mission: <strong>{mission.title}</strong>
            </span>
            <span>•</span>
            <span>{effectiveDayCount} Days Runway</span>
            <span>•</span>
            <span>
              {health.completionRatePercent}% complete ({health.completedEstimateMin}m /{' '}
              {health.totalEstimateMin}m)
            </span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Re-plan Trigger (Opens Confirmation Modal first) */}
          {!readOnly && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReplanConfirmOpen(true)}
              className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover text-warning"
            >
              <Sparkles className="h-3.5 w-3.5 text-warning" />
              <span>Re-plan</span>
            </Button>
          )}

          {/* Save Template */}
          {role === 'owner' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveAsTemplate}
              className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover"
              title="Save as reusable blueprint"
            >
              <LayoutTemplate className="h-3.5 w-3.5 text-info" />
              <span className="hidden sm:inline">Template</span>
            </Button>
          )}

          {/* Export (all days; available to every member, including view-only) */}
          {runway?._id && (
            <ExportMenu
              runwayId={runway._id}
              className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover"
            />
          )}

          {/* Roll Over Trigger */}
          {!readOnly && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRolloverOpen(true)}
              className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover"
            >
              <RotateCw className="h-3.5 w-3.5 text-primary" />
              <span>Roll Over</span>
            </Button>
          )}
        </div>
      </div>

      {/* Runway Pipeline Connected Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="relative pb-6 overflow-x-auto">
          {/* Connecting Pipeline Line */}
          <div className="absolute top-[48px] left-12 right-12 h-0.5 bg-gradient-to-r from-primary/30 via-info/30 to-border pointer-events-none z-0" />

          {/* Columns Track */}
          <div className="flex gap-5 relative z-10 min-w-max pb-4">
            {Array.from({ length: effectiveDayCount }).map((_, index) => {
              const daySteps = steps
                .filter((s) => s.dayIndex === index)
                .sort((a, b) => a.order.localeCompare(b.order));
              const dayStart = dayStartTimes[String(index)] || dayStartTimes[index] || null;
              const isDayFailed = failedIndices.includes(index);

              return (
                <RunwayDayColumn
                  key={index}
                  dayIndex={index}
                  missionId={mission._id}
                  steps={daySteps}
                  isToday={index === currentDayIndex}
                  dailyCapacityMin={dailyCapacityMin}
                  dayStartTime={dayStart}
                  isFailed={isDayFailed}
                  readOnly={readOnly}
                  onSelectStep={(s) => setSelectedStep(s)}
                  onAddStepInline={handleAddStepInline}
                  onQuickToggleStatus={handleQuickToggleStatus}
                  onStartDay={(d) => setConfirmStartDayIndex(d)}
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay for smooth preview */}
        <DragOverlay>
          {activeStep ? (
            <div className="w-72 shadow-2xl scale-105 pointer-events-none opacity-90">
              <RunwayStepCard step={activeStep} onSelect={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Step Edit & Timer Drawer */}
      <StepDrawer
        readOnly={readOnly}
        isOpen={!!selectedStep}
        step={selectedStep}
        onClose={() => setSelectedStep(null)}
        onStepUpdated={(updated) => {
          setSteps((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
          setSelectedStep(updated);
        }}
        onStepDeleted={(deletedId) => {
          setSteps((prev) => prev.filter((s) => s._id !== deletedId));
          setSelectedStep(null);
        }}
      />

      {/* Confirmation Modal 1: Re-plan Confirmation */}
      <Dialog open={isReplanConfirmOpen} onOpenChange={setIsReplanConfirmOpen}>
        <DialogContent className="max-w-md bg-surface border-border p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-warning font-semibold text-sm">
              <Sparkles className="h-4 w-4" />
              <span>AI Re-plan Confirmation</span>
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Re-distribute Unfinished Tasks?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Re-planning will evaluate all incomplete tasks in &ldquo;{mission.title}&rdquo; and
              re-balance them across future days to respect your daily work capacity.
              <br />
              <br />• Completed tasks will <strong>NOT</strong> be touched or removed.
              <br />
              • Unfinished tasks will be redistributed into optimal 15–60 min chunks.
              <br />• You will receive a preview of the new schedule before it is saved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 border-t border-border/60 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsReplanConfirmOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsReplanConfirmOpen(false);
                setIsReplanOpen(true);
              }}
              className="text-xs bg-warning hover:bg-warning/90 text-black font-semibold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Proceed to Re-plan</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal 3: Delete Runway Confirmation */}
      <Dialog open={isDeleteRunwayConfirmOpen} onOpenChange={setIsDeleteRunwayConfirmOpen}>
        <DialogContent className="max-w-md bg-surface border-border p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-danger font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Delete Runway Confirmation</span>
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Runway from Mission?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Are you sure you want to delete this execution runway? All scheduled tasks and daily
              steps under this runway will be permanently deleted.
              <br />
              <br />
              The parent mission <strong>&ldquo;{mission.title}&rdquo;</strong> will remain active,
              allowing you to create a new runway whenever you choose.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 border-t border-border/60 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteRunwayConfirmOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeletingRunway}
              onClick={handleExecuteDeleteRunway}
              className="text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeletingRunway ? 'Deleting...' : 'Delete Runway'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roll Over Modal */}
      <RolloverModal
        isOpen={isRolloverOpen}
        onClose={() => setIsRolloverOpen(false)}
        steps={steps}
        currentDayIndex={currentDayIndex}
        missionId={mission._id}
        dayCount={effectiveDayCount}
        dailyCapacityMin={dailyCapacityMin}
        onRolloverApplied={() => {
          window.location.reload();
        }}
      />

      {/* Re-plan AI Execution Modal */}
      <ReplanModal
        isOpen={isReplanOpen}
        onClose={() => setIsReplanOpen(false)}
        missionId={mission._id}
        missionTitle={mission.title}
        dailyCapacityMin={dailyCapacityMin}
        currentRunwayId={runway?._id}
        onReplanSaved={() => {
          window.location.reload();
        }}
      />

      {/* Start Day Confirmation Modal */}
      {confirmStartDayIndex !== null && (
        <ConfirmStartDayModal
          isOpen={confirmStartDayIndex !== null}
          onClose={() => setConfirmStartDayIndex(null)}
          dayIndex={confirmStartDayIndex}
          missionTitle={mission.title}
          onConfirm={handleConfirmStartDay}
        />
      )}
    </div>
  );
}
