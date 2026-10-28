'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  PlayCircle,
  AlertOctagon,
  CheckCircle,
  Plus,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCorners,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { StepData, StepDrawer } from '@/features/steps/components/step-drawer';
import { canEdit, MissionRole } from '@/lib/access';
import { plainPreview } from '@/lib/notes';
import { ExportMenu } from '@/features/export/components/export-menu';
import { ConfirmStartDayModal } from './confirm-start-day-modal';
import { ReplanModal } from './replan-modal';
import {
  actionCreateStep,
  actionUpdateStep,
  actionQuickUpdateStepStatus,
} from '@/features/missions/actions';
import { actionStartDay } from '@/features/runway/actions';
import { generateKeyBetween } from 'fractional-indexing';
import { calculateDayCapacity } from '@/lib/planning';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface DayPipelineMission {
  _id: string;
  title: string;
  color?: string;
  dayCount: number;
}

export interface DayPipelineRunway {
  _id: string;
  title: string;
  dayCount: number;
  startDate?: string;
  deadline?: string;
  dayStartTimes?: Record<string, string>;
  dayFailedIndices?: number[];
}

interface DayPipelineViewProps {
  mission: DayPipelineMission;
  runway: DayPipelineRunway;
  dayIndex: number;
  initialSteps: StepData[];
  dailyCapacityMin: number;
  role?: MissionRole;
}

const LANES = [
  {
    id: 'todo',
    title: 'To Do',
    icon: ListTodo,
    color: 'text-muted-foreground',
    badgeBg: 'bg-muted',
  },
  {
    id: 'doing',
    title: 'In Progress',
    icon: PlayCircle,
    color: 'text-primary',
    badgeBg: 'bg-primary/10 text-primary',
  },
  {
    id: 'blocked',
    title: 'Blocked',
    icon: AlertOctagon,
    color: 'text-danger',
    badgeBg: 'bg-danger/10 text-danger',
  },
  {
    id: 'done',
    title: 'Done',
    icon: CheckCircle,
    color: 'text-success',
    badgeBg: 'bg-success/10 text-success',
  },
] as const;

function DraggableStepCard({
  step,
  onSelect,
  readOnly = false,
}: {
  step: StepData;
  onSelect: (s: StepData) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: step._id,
    disabled: readOnly,
  });

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="p-3.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 min-h-[72px] opacity-40 select-none"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(step)}
      className={cn(
        'p-3.5 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all text-xs space-y-2 shadow-sm select-none',
        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        step.status === 'done' && 'opacity-70 bg-surface/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={cn(
            'font-semibold text-foreground leading-snug',
            step.status === 'done' && 'line-through text-muted-foreground'
          )}
        >
          {step.title}
        </h4>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded border border-border/50">
          {step.estimateMin}m
        </span>
      </div>

      {step.notes && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {plainPreview(step.notes)}
        </p>
      )}

      {step.checklist && step.checklist.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
          <CheckCircle2 className="h-3 w-3 text-primary" />
          <span>
            {step.checklist.filter((c) => c.done).length} / {step.checklist.length} items
          </span>
        </div>
      )}
    </div>
  );
}

function StatusLane({
  laneId,
  title,
  icon: Icon,
  color,
  badgeBg,
  steps,
  onSelectStep,
  onAddInline,
  readOnly = false,
}: {
  laneId: 'todo' | 'doing' | 'blocked' | 'done';
  title: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  steps: StepData[];
  onSelectStep: (step: StepData) => void;
  onAddInline?: (title: string) => void;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: laneId,
  });

  const [isAdding, setIsAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddInline?.(newTitle.trim());
    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-1 rounded-2xl border border-border/80 bg-surface/50 p-4 min-h-[460px] transition-all',
        isOver && 'ring-2 ring-primary/40 bg-primary/[0.03]'
      )}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', color)} />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{title}</h3>
        </div>
        <span
          className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold', badgeBg)}
        >
          {steps.length}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[200px]">
        {steps.map((step) => (
          <DraggableStepCard
            key={step._id}
            step={step}
            onSelect={onSelectStep}
            readOnly={readOnly}
          />
        ))}

        {steps.length === 0 && !isAdding && (
          <div className="h-32 flex items-center justify-center border border-dashed border-border/60 rounded-xl text-xs text-muted-foreground/60">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Inline Add (only on To Do lane) */}
      {laneId === 'todo' && onAddInline && (
        <div className="pt-3 mt-2 border-t border-border/50">
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title (press Enter to add)..."
                className="h-8 text-xs bg-surface border-border"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-medium hover:bg-primary-hover"
                >
                  Add Task
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-dashed border-border hover:border-primary/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DayPipelineView({
  mission,
  runway,
  dayIndex,
  initialSteps,
  dailyCapacityMin,
  role = 'owner',
}: DayPipelineViewProps) {
  const router = useRouter();
  const readOnly = !canEdit(role);
  const [steps, setSteps] = React.useState<StepData[]>(initialSteps);
  const [activeStep, setActiveStep] = React.useState<StepData | null>(null);
  const [selectedStep, setSelectedStep] = React.useState<StepData | null>(null);
  const [isConfirmStartOpen, setIsConfirmStartOpen] = React.useState(false);
  const [isReplanOpen, setIsReplanOpen] = React.useState(false);

  const [dayStartTime, setDayStartTime] = React.useState<string | null>(
    runway.dayStartTimes?.[String(dayIndex)] || runway.dayStartTimes?.[dayIndex] || null
  );
  const [isFailed, setIsFailed] = React.useState<boolean>(
    (runway.dayFailedIndices || []).includes(dayIndex)
  );

  const [timeLeftString, setTimeLeftString] = React.useState<string | null>(null);
  const [hoursLeftString, setHoursLeftString] = React.useState<string | null>(null);
  const [isOverdue, setIsOverdue] = React.useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Live 24h Countdown Tracker
  React.useEffect(() => {
    if (!dayStartTime) {
      setTimeLeftString(null);
      setHoursLeftString(null);
      setIsOverdue(false);
      return;
    }

    const startMs = new Date(dayStartTime).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const elapsedMs = now - startMs;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      const diffMs = twentyFourHoursMs - elapsedMs;

      if (diffMs <= 0) {
        setTimeLeftString('Expired');
        setHoursLeftString('0 hours left');
        setIsOverdue(true);
      } else {
        const totalHoursLeft = (diffMs / (1000 * 60 * 60)).toFixed(1);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeLeftString(`${hours}h ${mins}m ${secs}s`);
        setHoursLeftString(`${totalHoursLeft} hours left`);
        setIsOverdue(false);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [dayStartTime]);

  // Capacity calculation
  const capacity = React.useMemo(() => {
    return calculateDayCapacity(
      steps.map((s) => ({
        estimateMin: s.estimateMin,
        status: s.status,
        dayIndex: s.dayIndex,
      })),
      dayIndex,
      dailyCapacityMin
    );
  }, [steps, dayIndex, dailyCapacityMin]);

  const handleStartDayConfirmed = async (targetDayIndex: number) => {
    const nowIso = new Date().toISOString();
    setDayStartTime(nowIso);
    const res = await actionStartDay(runway._id, targetDayIndex);
    if (res.success) {
      toast.success(`Day ${targetDayIndex + 1} started! 24-hour completion clock active.`);
    } else {
      toast.error('Failed to start day clock.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const stepId = String(active.id);
    const overId = String(over.id);

    let targetLane: 'todo' | 'doing' | 'blocked' | 'done' | null = null;
    if (['todo', 'doing', 'blocked', 'done'].includes(overId as any)) {
      targetLane = overId as any;
    } else {
      const overStep = steps.find((s) => s._id === overId);
      if (overStep && ['todo', 'doing', 'blocked', 'done'].includes(overStep.status as any)) {
        targetLane = overStep.status as any;
      }
    }

    if (!targetLane) return;

    const currentStep = steps.find((s) => s._id === stepId);
    if (!currentStep || currentStep.status === targetLane) return;

    const previousSteps = [...steps];

    // Optimistic Update
    setSteps((prev) =>
      prev.map((s) => (s._id === stepId ? { ...s, status: targetLane as any } : s))
    );

    try {
      const res = await actionQuickUpdateStepStatus(stepId, targetLane);
      if (!res.success) {
        setSteps(previousSteps);
        toast.error('Could not update status');
      }
    } catch {
      setSteps(previousSteps);
      toast.error('Could not update status');
    }
  };

  const handleAddInline = async (title: string) => {
    const tempId = `temp-${Date.now()}`;
    const last = steps[steps.length - 1];
    const newOrder = generateKeyBetween(last ? last.order : null, null);

    const optimistic: StepData = {
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

    setSteps((prev) => [...prev, optimistic]);

    const res = await actionCreateStep({
      missionId: mission._id,
      runwayId: runway._id,
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
      toast.success('Task added to Day ' + (dayIndex + 1));
    } else {
      setSteps((prev) => prev.filter((s) => s._id !== tempId));
      toast.error('Failed to add task');
    }
  };

  const completedSteps = steps.filter((s) => s.status === 'done');
  const allCompleted = steps.length > 0 && completedSteps.length === steps.length;
  const isDraggingDay = (isOverdue || isFailed) && !allCompleted;

  return (
    <div className="space-y-6">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/runway?missionId=${mission._id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to &ldquo;{mission.title}&rdquo; Runway</span>
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="h-3.5 w-3.5 rounded-full shrink-0"
              style={{ backgroundColor: mission.color || '#7C5CFF' }}
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Day {dayIndex + 1} Pipeline Focus
            </h1>
            {allCompleted && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-success/20 text-success border border-success/30 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>All Tasks Completed</span>
              </span>
            )}
            {isDraggingDay && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-danger/20 text-danger border border-danger/30 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>24h Exceeded &bull; Dragging Schedule</span>
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
            <span>
              Mission: <strong>{mission.title}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Planned: {(capacity.plannedMin / 60).toFixed(1)}h /{' '}
              {(dailyCapacityMin / 60).toFixed(1)}h
            </span>
            <span>&bull;</span>
            <span>
              {completedSteps.length} of {steps.length} tasks done
            </span>
          </p>
        </div>

        {/* 24-Hour Timer Status / Start Day Trigger */}
        <div className="flex items-center gap-3">
          {!dayStartTime && readOnly ? null : !dayStartTime ? (
            <Button
              onClick={() => setIsConfirmStartOpen(true)}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Day (24-Hour Clock)</span>
            </Button>
          ) : (
            <div
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-mono shadow-sm',
                isDraggingDay
                  ? 'bg-danger/10 border-danger/40 text-danger'
                  : 'bg-primary/10 border-primary/30 text-primary'
              )}
            >
              <Clock className="h-4 w-4" />
              <div>
                <span className="font-bold block">
                  {isDraggingDay ? '24h Timer Expired' : timeLeftString || '24h Clock Active'}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {isDraggingDay
                    ? 'Tasks overdue'
                    : hoursLeftString
                      ? `${hoursLeftString} to end day`
                      : '24h countdown'}
                </span>
              </div>
            </div>
          )}

          {/* Exports only this day; available to every member, including view-only */}
          <ExportMenu runwayId={runway._id} dayIndex={dayIndex} />

          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReplanOpen(true)}
              className="text-xs gap-1.5 border-border bg-surface hover:bg-surface-hover text-warning"
            >
              <Sparkles className="h-3.5 w-3.5 text-warning" />
              <span>Re-plan</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dragging Schedule Alert Banner */}
      {isDraggingDay && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-danger shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-danger/20 shrink-0">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <strong className="text-sm font-bold block text-foreground">
                24-Hour Day Limit Exceeded
              </strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                This day has passed its 24-hour completion window with unfinished tasks remaining.
                This is dragging your overall milestone progress.
              </p>
            </div>
          </div>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setIsReplanOpen(true)}
              className="bg-danger hover:bg-danger/90 text-white text-xs gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Re-plan Runway to Mitigate Drag</span>
            </Button>
          )}
        </div>
      )}

      {/* 4 Kanban Status Columns DnD Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => {
          const st = steps.find((s) => s._id === e.active.id);
          if (st) setActiveStep(st);
        }}
        onDragEnd={(e) => {
          setActiveStep(null);
          if (!readOnly) handleDragEnd(e);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {LANES.map((lane) => (
            <StatusLane
              key={lane.id}
              laneId={lane.id}
              title={lane.title}
              icon={lane.icon}
              color={lane.color}
              badgeBg={lane.badgeBg}
              steps={steps.filter((s) =>
                lane.id === 'todo' ? s.status === 'todo' || !s.status : s.status === lane.id
              )}
              onSelectStep={(s) => setSelectedStep(s)}
              readOnly={readOnly}
              onAddInline={lane.id === 'todo' && !readOnly ? handleAddInline : undefined}
            />
          ))}
        </div>

        <DragOverlay>
          {activeStep ? (
            <div className="w-72 shadow-2xl scale-105 pointer-events-none opacity-95">
              <div className="p-3.5 rounded-xl border-2 border-primary bg-surface text-xs space-y-2 shadow-2xl">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-foreground leading-snug">{activeStep.title}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded border border-border/50">
                    {activeStep.estimateMin}m
                  </span>
                </div>
                {activeStep.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {plainPreview(activeStep.notes)}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Step Detail Drawer */}
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

      {/* Start Day Confirmation Modal */}
      <ConfirmStartDayModal
        isOpen={isConfirmStartOpen}
        onClose={() => setIsConfirmStartOpen(false)}
        dayIndex={dayIndex}
        missionTitle={mission.title}
        onConfirm={handleStartDayConfirmed}
      />

      {/* Re-plan Modal */}
      <ReplanModal
        isOpen={isReplanOpen}
        onClose={() => setIsReplanOpen(false)}
        missionId={mission._id}
        missionTitle={mission.title}
        dailyCapacityMin={dailyCapacityMin}
        currentRunwayId={runway._id}
        onReplanSaved={() => {
          router.push(`/runway?missionId=${mission._id}`);
        }}
      />
    </div>
  );
}
