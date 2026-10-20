'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StepData } from '@/features/steps/components/step-drawer';
import {
  Play,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  CircleDot,
  CheckCircle,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  DndContext,
  useDroppable,
  useDraggable,
  closestCorners,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayIndex: number;
  steps: StepData[];
  dailyCapacityMin: number;
  dayStartTime?: string | null;
  isFailed?: boolean;
  onStartDay: (dayIndex: number) => Promise<void>;
  onUpdateStepStatus: (stepId: string, newStatus: 'todo' | 'doing' | 'done') => Promise<void>;
  onSelectStep: (step: StepData) => void;
  onOpenReplan: () => void;
}

const LANES = [
  { id: 'todo', title: 'To Do', icon: ListTodo, color: 'text-muted-foreground' },
  { id: 'doing', title: 'Doing', icon: CircleDot, color: 'text-primary' },
  { id: 'done', title: 'Done', icon: CheckCircle, color: 'text-success' },
] as const;

function DraggableStepItem({
  step,
  onSelect,
}: {
  step: StepData;
  onSelect: (s: StepData) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: step._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(step)}
      className={cn(
        'p-3 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing text-xs space-y-1.5 shadow-sm',
        isDragging && 'opacity-50 ring-2 ring-primary'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground line-clamp-2">{step.title}</span>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
          {step.estimateMin}m
        </span>
      </div>
      {step.notes && <p className="text-[11px] text-muted-foreground line-clamp-1">{step.notes}</p>}
    </div>
  );
}

function LaneColumn({
  laneId,
  title,
  icon: Icon,
  color,
  steps,
  onSelectStep,
}: {
  laneId: 'todo' | 'doing' | 'done';
  title: string;
  icon: React.ElementType;
  color: string;
  steps: StepData[];
  onSelectStep: (step: StepData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: laneId,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-1 rounded-2xl border border-border/80 bg-surface/50 p-3 min-h-[320px] transition-all',
        isOver && 'ring-2 ring-primary/40 bg-primary/[0.03]'
      )}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', color)} />
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {steps.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {steps.map((step) => (
          <DraggableStepItem key={step._id} step={step} onSelect={onSelectStep} />
        ))}
        {steps.length === 0 && (
          <div className="h-28 flex items-center justify-center border border-dashed border-border/50 rounded-xl text-[11px] text-muted-foreground/60">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export function DayDetailModal({
  isOpen,
  onClose,
  dayIndex,
  steps,
  dailyCapacityMin,
  dayStartTime,
  isFailed,
  onStartDay,
  onUpdateStepStatus,
  onSelectStep,
  onOpenReplan,
}: DayDetailModalProps) {
  const [isStarting, setIsStarting] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);
  const [hasExceeded24h, setHasExceeded24h] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Calculate 24h timer if day was started
  React.useEffect(() => {
    if (!dayStartTime) {
      setTimeLeft(null);
      setHasExceeded24h(false);
      return;
    }

    const startMs = new Date(dayStartTime).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const elapsedMs = now - startMs;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      const diffMs = twentyFourHoursMs - elapsedMs;

      if (diffMs <= 0) {
        setTimeLeft('Expired');
        setHasExceeded24h(true);
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
        setHasExceeded24h(false);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [dayStartTime]);

  const totalMin = steps.reduce((acc, s) => acc + s.estimateMin, 0);
  const completedSteps = steps.filter((s) => s.status === 'done');
  const allCompleted = steps.length > 0 && completedSteps.length === steps.length;
  const isDayOverdue = (hasExceeded24h || isFailed) && !allCompleted;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStartDay(dayIndex);
      toast.success(`Day ${dayIndex + 1} started! 24h countdown began.`);
    } catch {
      toast.error('Failed to start day.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const stepId = String(active.id);
    const targetStatus = String(over.id) as 'todo' | 'doing' | 'done';

    if (['todo', 'doing', 'done'].includes(targetStatus)) {
      const currentStep = steps.find((s) => s._id === stepId);
      if (currentStep && currentStep.status !== targetStatus) {
        await onUpdateStepStatus(stepId, targetStatus);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-surface border-border text-foreground p-6 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <span>Day Focus Pipeline</span>
              </div>
              <DialogTitle className="text-xl font-extrabold flex items-center gap-2.5 mt-0.5">
                <span>Day {dayIndex + 1} Mini Pipeline</span>
                {allCompleted && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-success/20 text-success border border-success/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Completed</span>
                  </span>
                )}
                {isDayOverdue && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-danger/20 text-danger border border-danger/30 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    <span>24h Exceeded &bull; Dragging</span>
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Planned: {(totalMin / 60).toFixed(1)}h / {(dailyCapacityMin / 60).toFixed(1)}h
                &bull; {completedSteps.length} of {steps.length} tasks completed
              </DialogDescription>
            </div>

            {/* Start Day / Timer Tracker */}
            <div className="flex items-center gap-2">
              {!dayStartTime ? (
                <Button
                  onClick={handleStart}
                  disabled={isStarting}
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{isStarting ? 'Starting...' : 'Start Day (24h Clock)'}</span>
                </Button>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono',
                    isDayOverdue
                      ? 'bg-danger/10 border-danger/40 text-danger'
                      : 'bg-primary/10 border-primary/30 text-primary'
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {isDayOverdue ? 'Overdue: >24h elapsed' : `24h Clock: ${timeLeft || 'Active'}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Overdue dragging warning with Re-plan trigger */}
          {isDayOverdue && (
            <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-between text-xs text-danger">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This day exceeded the 24h completion limit and is dragging the overall mission
                  schedule.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onOpenReplan();
                }}
                className="text-xs border-danger/40 hover:bg-danger/20 text-danger gap-1 shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                <span>Re-plan Runway</span>
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* 3 Status Columns DnD Area */}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
            {LANES.map((lane) => (
              <LaneColumn
                key={lane.id}
                laneId={lane.id}
                title={lane.title}
                icon={lane.icon}
                color={lane.color}
                steps={steps.filter((s) =>
                  lane.id === 'todo' ? s.status === 'todo' || !s.status : s.status === lane.id
                )}
                onSelectStep={onSelectStep}
              />
            ))}
          </div>
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}
