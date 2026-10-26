'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, CheckSquare, GripVertical, CheckCircle2 } from 'lucide-react';
import { StepData } from '@/features/steps/components/step-drawer';
import { cn } from '@/lib/utils';

interface RunwayStepCardProps {
  step: StepData;
  onSelect: (step: StepData) => void;
  onQuickToggleStatus?: (stepId: string, currentStatus: StepData['status']) => void;
  readOnly?: boolean;
}

export function RunwayStepCard({
  step,
  onSelect,
  onQuickToggleStatus,
  readOnly = false,
}: RunwayStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step._id,
    disabled: readOnly,
    data: {
      step,
      dayIndex: step.dayIndex,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = step.status === 'done';
  const checklistTotal = step.checklist?.length || 0;
  const checklistDone = step.checklist?.filter((c) => c.done).length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-xs shadow-sm transition-all hover:border-primary/40 select-none',
        isDragging && 'opacity-40 ring-2 ring-primary scale-[1.02] z-20 shadow-xl',
        isCompleted && 'opacity-65 border-border/50 bg-muted/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Quick status toggle button */}
        <button
          type="button"
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) onQuickToggleStatus?.(step._id, step.status);
          }}
          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
          title={isCompleted ? 'Mark uncompleted' : 'Mark done'}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <div className="h-4 w-4 rounded-md border border-border group-hover:border-primary/60 transition-colors" />
          )}
        </button>

        {/* Step Title (Click to open Drawer) */}
        <div onClick={() => onSelect(step)} className="flex-1 cursor-pointer min-w-0">
          <p
            className={cn(
              'font-medium text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors',
              isCompleted && 'line-through text-muted-foreground'
            )}
          >
            {step.title}
          </p>
        </div>

        {/* Drag handle */}
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
            aria-label="Drag step"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Footer Info: Estimate, Checklist, and Actuals */}
      <div
        onClick={() => onSelect(step)}
        className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono pt-1 cursor-pointer border-t border-border/40"
      >
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{step.estimateMin}m</span>
        </div>

        {checklistTotal > 0 && (
          <div className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            <span>
              {checklistDone}/{checklistTotal}
            </span>
          </div>
        )}

        {step.actualMin > 0 && (
          <span className="ml-auto text-primary/80 font-semibold">{step.actualMin}m act</span>
        )}
      </div>
    </div>
  );
}
