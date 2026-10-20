'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { replanMissionAction, applyReplanAction } from '@/features/brain-dump/actions';
import { ParsedPlan } from '@/lib/templates/parser';
import {
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface FeasibilityInfo {
  isFeasible: boolean;
  daysLeft: number;
  totalRemainingMin: number;
  availableCapacityMin: number;
  extraDaysNeeded: number;
  extraHoursPerDay: number;
}

interface ReplanModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId: string;
  missionTitle: string;
  dailyCapacityMin?: number;
  currentRunwayId?: string;
  onReplanSaved?: () => void;
}

export function ReplanModal({
  isOpen,
  onClose,
  missionId,
  missionTitle,
  dailyCapacityMin = 240,
  currentRunwayId,
  onReplanSaved,
}: ReplanModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [replannedPlan, setReplannedPlan] = useState<ParsedPlan | null>(null);
  const [feasibility, setFeasibility] = useState<FeasibilityInfo | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const hoursPerDay = Math.round((dailyCapacityMin / 60) * 10) / 10;

  const handleStartReplan = async () => {
    setIsLoading(true);
    try {
      const res = await replanMissionAction(missionId, hoursPerDay);
      if (res.success && res.plan) {
        setReplannedPlan(res.plan);
        if (res.feasibility) {
          setFeasibility(res.feasibility);
        }
        toast.success('Generated re-balanced schedule preview.');
      } else {
        toast.error(res.error || 'Failed to re-plan mission.');
      }
    } catch {
      toast.error('Unexpected error during re-planning.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyReplan = async () => {
    if (!replannedPlan) return;
    setIsApplying(true);

    try {
      const res = await applyReplanAction(missionId, replannedPlan);
      if (res.success) {
        toast.success(
          `Created Re-plan version ${res.version}! Original runway is preserved in history.`
        );
        onClose();
        if (onReplanSaved) {
          onReplanSaved();
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.error || 'Failed to save re-plan.');
      }
    } catch {
      toast.error('Failed to apply re-plan changes.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-surface border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Pipeline Re-balancer</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Re-plan &quot;{missionTitle}&quot;
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            When falling behind schedule or exceeding 24h day limits, Lockin recalculates your
            remaining unfinished workload and redistributes it across future days to respect your
            daily work capacity.
          </DialogDescription>
        </DialogHeader>

        {!replannedPlan ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm text-foreground/80 max-w-md mx-auto">
              Ready to analyze your unfinished steps and balance your runway pipeline at{' '}
              {hoursPerDay}h/day?
            </p>
            <Button
              onClick={handleStartReplan}
              disabled={isLoading}
              className="bg-primary hover:bg-primary-hover text-white font-medium text-xs gap-2"
            >
              {isLoading ? 'Re-calculating Runway...' : 'Generate Balanced Re-plan'}
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {/* Feasibility Alert Banner */}
            {feasibility && (
              <div>
                {!feasibility.isFeasible ? (
                  <div className="rounded-xl border border-warning/50 bg-warning/10 p-3.5 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-warning">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        Capacity Overload: Impossible to finish on time with {hoursPerDay}h/day!
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      You have <strong>{(feasibility.totalRemainingMin / 60).toFixed(1)}h</strong>{' '}
                      of incomplete work remaining, but only{' '}
                      <strong>{feasibility.daysLeft} days</strong> before deadline (total standard
                      capacity: {(feasibility.availableCapacityMin / 60).toFixed(1)}h).
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="bg-background/80 p-2 rounded-lg border border-warning/30">
                        <span className="text-muted-foreground block text-[10px]">
                          Option A (Extend):
                        </span>
                        <strong className="text-warning">
                          +{feasibility.extraDaysNeeded} extra days needed
                        </strong>
                      </div>
                      <div className="bg-background/80 p-2 rounded-lg border border-warning/30">
                        <span className="text-muted-foreground block text-[10px]">
                          Option B (Overwork):
                        </span>
                        <strong className="text-warning">
                          +{feasibility.extraHoursPerDay}h/day extra effort
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs flex items-center gap-2 text-success font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Feasible: Remaining work cleanly fits into {feasibility.daysLeft} days at{' '}
                      {hoursPerDay}h/day.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-center justify-between">
              <span className="font-medium text-foreground">
                Redistributed across {replannedPlan.dayCount} days ({replannedPlan.hoursPerDay}h/day
                cap)
              </span>
              <span className="text-primary font-mono font-semibold">
                {replannedPlan.days.reduce((acc, d) => acc + d.steps.length, 0)} steps
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {replannedPlan.days.map((day) => {
                const dayMins = day.steps.reduce((acc, s) => acc + s.estimateMin, 0);
                return (
                  <div
                    key={day.dayIndex}
                    className="p-3 rounded-lg border border-border/80 bg-surface/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Day {day.dayIndex + 1}</span>
                      <span className="text-muted-foreground font-mono">{dayMins}m</span>
                    </div>
                    <ul className="space-y-1">
                      {day.steps.map((st, i) => (
                        <li
                          key={i}
                          className="text-muted-foreground truncate flex items-center gap-1.5"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="truncate">{st.title}</span>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">
                            {st.estimateMin}m
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/60 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          {replannedPlan && (
            <Button
              size="sm"
              onClick={handleApplyReplan}
              disabled={isApplying}
              className="bg-primary hover:bg-primary-hover text-white font-medium text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isApplying ? 'Creating New Version...' : 'Save as New Runway Version'}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
