'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Clock, Sparkles } from 'lucide-react';
import { StepData } from '@/features/steps/components/step-drawer';
import { RunwayStepCard } from './runway-step-card';
import { calculateDayCapacity } from '@/lib/planning';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface RunwayDayColumnProps {
  dayIndex: number;
  steps: StepData[];
  isToday: boolean;
  dailyCapacityMin?: number;
  onSelectStep: (step: StepData) => void;
  onAddStepInline: (dayIndex: number, title: string) => void;
  onQuickToggleStatus?: (stepId: string, currentStatus: StepData['status']) => void;
}

export function RunwayDayColumn({
  dayIndex,
  steps,
  isToday,
  dailyCapacityMin = 240,
  onSelectStep,
  onAddStepInline,
  onQuickToggleStatus,
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-2xl border bg-[#0F0F18] p-3.5 transition-all select-none relative',
        // Finished day glows lime
        isFinished && 'border-success/40 bg-success/[0.02] shadow-lg shadow-success/10',
        // Today is outlined violet
        isToday &&
          !isFinished &&
          'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10',
        // Overloaded turns amber
        isOverloaded &&
          !isFinished &&
          'border-warning/50 bg-warning/[0.02] shadow-lg shadow-warning/10',
        // Default border
        !isFinished && !isToday && !isOverloaded && 'border-border/80',
        isOver && 'ring-2 ring-info/50 bg-info/[0.03]'
      )}
    >
      {/* Column Header */}
      <div className="pb-3 border-b border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wider',
                isToday ? 'text-primary' : 'text-foreground'
              )}
            >
              Day {dayIndex + 1}
            </span>
            {isToday && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                Today
              </span>
            )}
            {isFinished && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-success/20 text-success border border-success/30">
                Done
              </span>
            )}
          </div>

          <span className="text-[11px] font-mono text-muted-foreground">
            {steps.length} {steps.length === 1 ? 'task' : 'tasks'}
          </span>
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
                isOverloaded
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
                isOverloaded
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
