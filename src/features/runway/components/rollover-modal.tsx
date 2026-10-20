'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { previewRollover, MissionHealthResult } from '@/lib/planning';
import { StepData } from '@/features/steps/components/step-drawer';
import { actionRolloverSteps } from '@/features/missions/actions';
import { ArrowRight, RotateCw, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface RolloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId: string;
  steps: StepData[];
  dayCount: number;
  currentDayIndex: number;
  dailyCapacityMin?: number;
  onRolloverApplied: () => void;
}

export function RolloverModal({
  isOpen,
  onClose,
  missionId,
  steps,
  dayCount,
  currentDayIndex,
  dailyCapacityMin = 240,
  onRolloverApplied,
}: RolloverModalProps) {
  const [isApplying, setIsApplying] = React.useState(false);

  // Compute preview using pure planning function
  const preview = React.useMemo(() => {
    if (!steps || steps.length === 0) return null;
    return previewRollover({
      steps: steps.map((s) => ({
        id: s._id,
        estimateMin: s.estimateMin,
        status: s.status,
        dayIndex: s.dayIndex,
      })),
      currentDayIndex,
      targetDayIndex: currentDayIndex,
      dayCount,
      dailyCapacityMin,
    });
  }, [steps, currentDayIndex, dayCount, dailyCapacityMin]);

  if (!preview) return null;

  const handleApply = async () => {
    if (preview.stepsToMove.length === 0) {
      toast.info('No past unfinished steps found to roll over.');
      onClose();
      return;
    }

    setIsApplying(true);
    const res = await actionRolloverSteps({
      missionId,
      moves: preview.stepsToMove,
    });
    setIsApplying(false);

    if (res.success) {
      toast.success(`Rolled over ${res.count} step(s) to Day ${currentDayIndex + 1}!`);
      onRolloverApplied();
      onClose();
    } else {
      toast.error('Failed to apply rollover');
    }
  };

  const getHealthBadge = (health: MissionHealthResult['health']) => {
    switch (health) {
      case 'On track':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/20 text-success border border-success/30">
            On track
          </span>
        );
      case 'At risk':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning border border-warning/30">
            At risk
          </span>
        );
      case 'Behind':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/20 text-danger border border-danger/30">
            Behind
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-info/20 text-info border border-info/30">
            Completed
          </span>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-surface border-border p-6 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <RotateCw className="h-4 w-4" />
            <span>Roll Over Unfinished Work</span>
          </div>
          <DialogTitle className="text-base font-bold">Simulate & Advance Schedule</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Move incomplete steps from earlier days forward into Day {currentDayIndex + 1}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {preview.stepsToMove.length === 0 ? (
            <div className="p-4 rounded-xl border border-border bg-surface-hover/30 text-center text-xs text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-success mx-auto mb-1.5" />
              All steps from past days are completed or accounted for.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Step Count Overview */}
              <div className="p-3 rounded-xl border border-border bg-surface-hover/40 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Steps to move:</span>
                <span className="font-semibold text-foreground">
                  {preview.stepsToMove.length} task(s)
                </span>
              </div>

              {/* Health Impact Comparison */}
              <div className="p-4 rounded-xl border border-border bg-surface-hover/20 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Projected Health Status
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <span className="block text-[10px] text-muted-foreground mb-1">Current</span>
                    {getHealthBadge(preview.currentHealth.health)}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-center">
                    <span className="block text-[10px] text-muted-foreground mb-1">
                      After Rollover
                    </span>
                    {getHealthBadge(preview.simulatedHealth.health)}
                  </div>
                </div>

                {/* Day Capacity Change */}
                <div className="pt-2 border-t border-border/50 text-xs flex items-center justify-between text-muted-foreground">
                  <span>Day {currentDayIndex + 1} planned load:</span>
                  <span
                    className={
                      preview.targetDayCapacityAfter.isOverloaded
                        ? 'text-warning font-semibold'
                        : 'text-foreground'
                    }
                  >
                    {(preview.targetDayCapacityBefore.plannedMin / 60).toFixed(1)}h →{' '}
                    {(preview.targetDayCapacityAfter.plannedMin / 60).toFixed(1)}h /{' '}
                    {(dailyCapacityMin / 60).toFixed(1)}h
                  </span>
                </div>

                {preview.targetDayCapacityAfter.isOverloaded && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Target day will become overloaded. Pace workload accordingly.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying || preview.stepsToMove.length === 0}
            className="text-xs bg-primary hover:bg-primary-hover text-white gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>{isApplying ? 'Applying...' : 'Apply Rollover'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
