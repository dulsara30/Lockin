'use client';

import * as React from 'react';
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
import { calculateMissionHealth, MissionHealthResult } from '@/lib/planning';
import { actionCreateStep, actionReorderStep, actionUpdateStep } from '@/features/missions/actions';
import { Button } from '@/components/ui/button';
import { RotateCw, Plus, Sparkles, Route, ChevronDown, Info, Calendar } from 'lucide-react';
import { toast } from 'sonner';

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

interface RunwayPipelineProps {
  mission: MissionData;
  initialSteps: StepData[];
  missionsList?: MissionData[];
  onMissionChange?: (missionId: string) => void;
}

export function RunwayPipeline({
  mission,
  initialSteps,
  missionsList = [],
  onMissionChange,
}: RunwayPipelineProps) {
  const [steps, setSteps] = React.useState<StepData[]>(initialSteps);
  const [activeStep, setActiveStep] = React.useState<StepData | null>(null);
  const [selectedStep, setSelectedStep] = React.useState<StepData | null>(null);
  const [isRolloverOpen, setIsRolloverOpen] = React.useState(false);
  const [isReplanOpen, setIsReplanOpen] = React.useState(false);
  const [currentDayIndex, setCurrentDayIndex] = React.useState(0);

  // Synchronize initial steps
  React.useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  // Compute current day index based on start date
  React.useEffect(() => {
    if (mission.startDate) {
      const start = new Date(mission.startDate).getTime();
      const now = new Date().getTime();
      const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      setCurrentDayIndex(Math.max(0, Math.min(mission.dayCount - 1, diffDays)));
    }
  }, [mission.startDate, mission.dayCount]);

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
  const health = React.useMemo(() => {
    return calculateMissionHealth({
      steps: steps.map((s) => ({
        estimateMin: s.estimateMin,
        status: s.status,
        dayIndex: s.dayIndex,
      })),
      dayCount: mission.dayCount,
      currentDayIndex,
      dailyCapacityMin: 240,
    });
  }, [steps, mission.dayCount, currentDayIndex]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const found = steps.find((s) => s._id === active.id);
    if (found) {
      setActiveStep(found);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStep(null);

    if (!over) return;

    const activeId = active.id as string;
    const draggedStep = steps.find((s) => s._id === activeId);
    if (!draggedStep) return;

    // Target could be another step or a day column container
    let targetDayIndex = draggedStep.dayIndex;
    const overId = over.id as string;

    if (overId.startsWith('day-')) {
      targetDayIndex = parseInt(overId.replace('day-', ''), 10);
    } else {
      const overStep = steps.find((s) => s._id === overId);
      if (overStep) {
        targetDayIndex = overStep.dayIndex;
      }
    }

    // Target day steps sorted by order
    const daySteps = steps
      .filter((s) => s.dayIndex === targetDayIndex && s._id !== activeId)
      .sort((a, b) => a.order.localeCompare(b.order));

    let prevOrder: string | null = null;
    let nextOrder: string | null = null;

    if (overId.startsWith('day-')) {
      // Dropped on empty area of column: place at the end
      prevOrder = daySteps.length > 0 ? daySteps[daySteps.length - 1].order : null;
      nextOrder = null;
    } else {
      const overIndex = daySteps.findIndex((s) => s._id === overId);
      if (overIndex >= 0) {
        prevOrder = overIndex > 0 ? daySteps[overIndex - 1].order : null;
        nextOrder = daySteps[overIndex].order;
      } else {
        prevOrder = daySteps.length > 0 ? daySteps[daySteps.length - 1].order : null;
        nextOrder = null;
      }
    }

    const newOrder = generateKeyBetween(prevOrder, nextOrder);

    // Optimistic state update
    const updatedSteps = steps.map((s) => {
      if (s._id === activeId) {
        return { ...s, dayIndex: targetDayIndex, order: newOrder };
      }
      return s;
    });

    setSteps(updatedSteps);

    // Single write to database
    const res = await actionReorderStep({
      stepId: activeId,
      newDayIndex: targetDayIndex,
      newOrder,
    });

    if (!res.success) {
      toast.error('Failed to sync reorder');
      setSteps(steps); // Rollback
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

  const handleQuickToggleStatus = async (stepId: string, currentStatus: StepData['status']) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    setSteps((prev) => prev.map((s) => (s._id === stepId ? { ...s, status: newStatus } : s)));

    const res = await actionUpdateStep(stepId, { status: newStatus });
    if (!res.success) {
      setSteps((prev) => prev.map((s) => (s._id === stepId ? { ...s, status: currentStatus } : s)));
      toast.error('Failed to update status');
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
      {/* Top Runway Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: mission.color || '#7C5CFF' }}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-lg">
              {mission.title}
            </h1>
            {getHealthBadge(health.health)}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{mission.dayCount} Days Runway</span>
            <span>•</span>
            <span>
              {health.completionRatePercent}% complete ({health.completedEstimateMin}m /{' '}
              {health.totalEstimateMin}m)
            </span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Re-plan Trigger */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsReplanOpen(true)}
            className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover text-warning"
          >
            <Sparkles className="h-3.5 w-3.5 text-warning" />
            <span>Re-plan</span>
          </Button>

          {/* Roll Over Trigger */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsRolloverOpen(true)}
            className="text-xs gap-1.5 bg-surface border-border hover:bg-surface-hover"
          >
            <RotateCw className="h-3.5 w-3.5 text-primary" />
            <span>Roll Over</span>
          </Button>
        </div>
      </div>

      {/* Runway Pipeline Connected Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative pb-6 overflow-x-auto">
          {/* Connecting Pipeline Line */}
          <div className="absolute top-[48px] left-12 right-12 h-0.5 bg-gradient-to-r from-primary/30 via-info/30 to-border pointer-events-none z-0" />

          {/* Columns Track */}
          <div className="flex gap-5 relative z-10 min-w-max pb-4">
            {Array.from({ length: mission.dayCount }).map((_, index) => {
              const daySteps = steps
                .filter((s) => s.dayIndex === index)
                .sort((a, b) => a.order.localeCompare(b.order));

              return (
                <RunwayDayColumn
                  key={index}
                  dayIndex={index}
                  steps={daySteps}
                  isToday={index === currentDayIndex}
                  dailyCapacityMin={240}
                  onSelectStep={(s) => setSelectedStep(s)}
                  onAddStepInline={handleAddStepInline}
                  onQuickToggleStatus={handleQuickToggleStatus}
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

      {/* Step Edit & Context Drawer */}
      <StepDrawer
        step={selectedStep}
        isOpen={!!selectedStep}
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

      {/* Roll Over Modal Preview */}
      <RolloverModal
        isOpen={isRolloverOpen}
        onClose={() => setIsRolloverOpen(false)}
        missionId={mission._id}
        steps={steps}
        dayCount={mission.dayCount}
        currentDayIndex={currentDayIndex}
        dailyCapacityMin={240}
        onRolloverApplied={() => {
          // Re-fetch steps or reload
          window.location.reload();
        }}
      />
    </div>
  );
}
