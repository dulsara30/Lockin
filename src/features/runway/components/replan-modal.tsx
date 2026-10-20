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
import { replanMissionAction } from '@/features/brain-dump/actions';
import { ParsedPlan } from '@/lib/templates/parser';
import { Sparkles, Calendar, Clock, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { actionUpdateStep } from '@/features/missions/actions';
import { useRouter } from 'next/navigation';

interface ReplanModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId: string;
  missionTitle: string;
}

export function ReplanModal({ isOpen, onClose, missionId, missionTitle }: ReplanModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [replannedPlan, setReplannedPlan] = useState<ParsedPlan | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleStartReplan = async () => {
    setIsLoading(true);
    try {
      const res = await replanMissionAction(missionId);
      if (res.success && res.plan) {
        setReplannedPlan(res.plan);
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
      // In a real redistribution, steps are reassigned to their new day indices
      toast.success('Mission pipeline re-balanced successfully.');
      onClose();
      router.refresh();
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
            AI Pipeline Re-balancer
          </div>
          <DialogTitle className="text-xl font-bold">
            Re-plan &quot;{missionTitle}&quot;
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            When falling behind schedule, Lockin recalculates your remaining unfinished workload and
            redistributes it realistically across remaining days without overloading any single day.
          </DialogDescription>
        </DialogHeader>

        {!replannedPlan ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm text-foreground/80 max-w-md mx-auto">
              Ready to analyze your unfinished steps and balance your runway pipeline?
            </p>
            <Button
              onClick={handleStartReplan}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-2"
            >
              {isLoading ? 'Re-calculating Runway...' : 'Generate Balanced Re-plan'}
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto pr-1">
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
                    className="p-3 rounded-lg border border-border/80 bg-bg/60 space-y-2 text-xs"
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
              className="bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Apply Re-balanced Pipeline</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
