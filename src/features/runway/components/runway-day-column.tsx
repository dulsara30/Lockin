'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Clock, Sparkles, Play, AlertTriangle, Maximize2 } from 'lucide-react';
import { StepData } from '@/features/steps/components/step-drawer';
import { RunwayStepCard } from './runway-step-card';
import { calculateDayCapacity } from '@/lib/planning';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface RunwayDayColumnProps {
  dayIndex: number;
  missionId?: string;
  steps: StepData[];
  isToday: boolean;
  dailyCapacityMin?: number;
  dayStartTime?: string | null;
  isFailed?: boolean;
  onSelectStep: (step: StepData) => void;
  onAddStepInline: (dayIndex: number, title: string) => void;
  onQuickToggleStatus?: (stepId: string, currentStatus: StepData['status']) => void;
  onStartDay?: (dayIndex: number) => void;
}

export function RunwayDayColumn({
  dayIndex,
  missionId,
  steps,
  isToday,
  dailyCapacityMin = 240,
  dayStartTime,
  isFailed,
  onSelectStep,
  onAddStepInline,
  onQuickToggleStatus,
  onStartDay,
}: RunwayDayColumnProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}`,
    data: {
      type: 'column',
      dayIndex,
    },
  });

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

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddStepInline(dayIndex, newTitle.trim());
    setNewTitle('');
    setIsAdding(false);
  };

  // Determine glow styling
  const isFinished = capacity.isCompleted;
  const isOverloaded = capacity.isOverloaded;

  // Check if 24h has expired
  const isOverdue = React.useMemo(() => {
    if (isFinished) return false;
    if (isFailed) return true;
    if (!dayStartTime) return false;
    const startMs = new Date(dayStartTime).getTime();
    return Date.now() - startMs > 24 * 60 * 60 * 1000;
  }, [isFinished, isFailed, dayStartTime]);

  // Hours left to end day
  const hoursLeftDisplay = React.useMemo(() => {
    if (!dayStartTime || isFinished) return null;
    const startMs = new Date(dayStartTime).getTime();
    const elapsed = Date.now() - startMs;
    const leftMs = 24 * 60 * 60 * 1000 - elapsed;
    if (leftMs <= 0) return 'Overdue';
    const hours = Math.floor(leftMs / (1000 * 60 * 60));
    const mins = Math.floor((leftMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  }, [dayStartTime, isFinished]);

  const dayUrl = missionId ? `/runway/day?missionId=${missionId}&dayIndex=${dayIndex}` : '#';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-2xl border bg-surface/60 p-3.5 transition-all select-none relative',
        // Overdue failure turns red
        isOverdue && 'border-danger/60 bg-danger/[0.03] shadow-lg shadow-danger/10',
        // Finished day glows lime
        !isOverdue &&
          isFinished &&
          'border-success/40 bg-success/[0.02] shadow-lg shadow-success/10',
        // Today is outlined violet
        !isOverdue &&
          isToday &&
          !isFinished &&
          'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10',
        // Overloaded turns amber
        !isOverdue &&
          isOverloaded &&
          !isFinished &&
          'border-warning/50 bg-warning/[0.02] shadow-lg shadow-warning/10',
        // Default border
        !isOverdue && !isFinished && !isToday && !isOverloaded && 'border-border/80',
        isOver && 'ring-2 ring-info/50 bg-info/[0.03]'
      )}
    >
      {/* Column Header */}
      <div className="pb-3 border-b border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <Link
            href={dayUrl}
            className="flex items-center gap-1.5 cursor-pointer group"
            title="Click to open dedicated day focus pipeline"
          >
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wider group-hover:text-primary transition-colors',
                isOverdue ? 'text-danger' : isToday ? 'text-primary' : 'text-foreground'
              )}
            >
              Day {dayIndex + 1}
            </span>
            <Maximize2 className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all" />

            {isOverdue && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-danger/20 text-danger border border-danger/30 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                <span>Overdue</span>
              </span>
            )}
            {isToday && !isOverdue && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                Today
              </span>
            )}
            {isFinished && !isOverdue && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-success/20 text-success border border-success/30">
                Done
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1.5">
            {!dayStartTime && onStartDay && !isFinished && (
              <button
                type="button"
                onClick={() => onStartDay(dayIndex)}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1 transition-colors"
                title="Start 24-hour countdown for this day"
              >
                <Play className="h-2.5 w-2.5 fill-current" />
                <span>Start Day</span>
              </button>
            )}

            {hoursLeftDisplay && !isFinished && (
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border',
                  isOverdue
                    ? 'bg-danger/15 text-danger border-danger/30'
                    : 'bg-primary/10 text-primary border-primary/25'
                )}
                title="Remaining time in 24h window"
              >
                {hoursLeftDisplay}
              </span>
            )}

            <span className="text-[11px] font-mono text-muted-foreground">
              {steps.length} {steps.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
        </div>

        {/* Capacity Meter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {(capacity.plannedMin / 60).toFixed(1)}h / {(dailyCapacityMin / 60).toFixed(1)}h
              </span>
            </span>
            <span
              className={cn(
                'font-semibold',
                isOverdue
                  ? 'text-danger'
                  : isOverloaded
                    ? 'text-warning'
                    : isFinished
                      ? 'text-success'
                      : 'text-muted-foreground'
              )}
            >
              {capacity.percentageUsed}%
            </span>
          </div>

          {/* Meter Bar */}
          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden border border-border/40">
            <div
              className={cn(
                'h-full transition-all duration-base rounded-full',
                isOverdue
                  ? 'bg-danger shadow-sm shadow-danger/50'
                  : isOverloaded
                    ? 'bg-warning shadow-sm shadow-warning/50'
                    : isFinished
                      ? 'bg-success shadow-sm shadow-success/50'
                      : 'bg-primary'
              )}
              style={{ width: `${Math.min(100, capacity.percentageUsed)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step List Container */}
      <div className="flex-1 overflow-y-auto space-y-2 py-3 min-h-[140px]">
        <SortableContext items={steps.map((s) => s._id)} strategy={verticalListSortingStrategy}>
          {steps.map((step) => (
            <RunwayStepCard
              key={step._id}
              step={step}
              onSelect={onSelectStep}
              onQuickToggleStatus={onQuickToggleStatus}
            />
          ))}
        </SortableContext>

        {steps.length === 0 && !isAdding && (
          <div className="h-24 flex items-center justify-center border border-dashed border-border/40 rounded-xl text-center text-muted-foreground/60 text-xs">
            Empty lane
          </div>
        )}
      </div>

      {/* Inline Add Step */}
      <div className="pt-2 border-t border-border/50">
        {isAdding ? (
          <form onSubmit={handleInlineSubmit} className="space-y-2">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Step title (press Enter to add)..."
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
                className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-medium hover:bg-primary-hover transition-colors"
              >
                Add
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-transparent hover:border-border/60 hover:bg-surface/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Step</span>
          </button>
        )}
      </div>
    </div>
  );
}
