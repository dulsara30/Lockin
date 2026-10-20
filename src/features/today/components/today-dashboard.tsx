'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Flame,
  Clock,
  Sparkles,
  CheckCircle2,
  Zap,
  Calendar,
  ArrowRight,
  Target,
  Play,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actionUpdateStep } from '@/features/missions/actions';
import { getDailyBriefAction } from '@/features/brain-dump/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StepItem {
  _id: string;
  missionId: string;
  title: string;
  status: string;
  estimateMin: number;
  actualMin: number;
  dayIndex: number;
  missionTitle: string;
  missionColor: string;
  checklist: { text: string; done: boolean }[];
}

interface TodayDashboardProps {
  todaySteps: StepItem[];
  nextUpStep: StepItem | null;
  totalPlannedMin: number;
  totalCompletedMin: number;
  streakDays: number;
}

export function TodayDashboard({
  todaySteps,
  nextUpStep: _nextUpStep,
  totalPlannedMin,
  totalCompletedMin: _totalCompletedMin,
  streakDays,
}: TodayDashboardProps) {
  const [steps, setSteps] = React.useState(todaySteps);
  const [dailyBrief, setDailyBrief] = React.useState<string | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = React.useState(false);
  const capacityMin = 240;

  const completedToday = steps.filter((s) => s.status === 'done').length;
  const totalToday = steps.length;
  const completedMin = steps
    .filter((s) => s.status === 'done')
    .reduce((a, s) => a + s.estimateMin, 0);
  const capacityPercent = Math.min(100, Math.round((totalPlannedMin / capacityMin) * 100));
  const nextUp =
    steps.find((s) => s.status === 'doing') || steps.find((s) => s.status === 'todo') || null;

  const handleToggleDone = async (stepId: string, current: string) => {
    const newStatus = current === 'done' ? 'todo' : 'done';
    setSteps((prev) => prev.map((s) => (s._id === stepId ? { ...s, status: newStatus } : s)));
    const res = await actionUpdateStep(stepId, { status: newStatus });
    if (!res.success) {
      setSteps((prev) => prev.map((s) => (s._id === stepId ? { ...s, status: current } : s)));
      toast.error('Failed to update step');
    } else if (newStatus === 'done') {
      toast.success('Step complete! 🎯');
    }
  };

  const handleGenerateBrief = async () => {
    setIsLoadingBrief(true);
    try {
      const res = await getDailyBriefAction();
      if (res.success && res.brief) {
        setDailyBrief(res.brief);
        toast.success('Strategic daily brief generated.');
      } else {
        toast.error(res.error || 'Could not generate briefing.');
      }
    } catch {
      toast.error('Unexpected error generating briefing.');
    } finally {
      setIsLoadingBrief(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{today}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Today</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
            <Flame
              className={cn(
                'h-4 w-4',
                streakDays > 0 ? 'text-warning fill-warning' : 'text-muted-foreground'
              )}
            />
            <span className="text-xs font-bold text-foreground">{streakDays} Day Streak</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
            <Clock className="h-4 w-4 text-info" />
            <span className="text-xs font-mono text-muted-foreground">
              {(totalPlannedMin / 60).toFixed(1)}h / {(capacityMin / 60).toFixed(1)}h
            </span>
          </div>
        </div>
      </div>

      {/* Daily Brief (Manual trigger only) */}
      <div>
        {!dailyBrief ? (
          <button
            onClick={handleGenerateBrief}
            disabled={isLoadingBrief}
            className="inline-flex items-center gap-2 text-xs text-primary font-medium hover:text-primary/90 transition-colors bg-primary/10 border border-primary/20 hover:border-primary/40 rounded-xl px-3.5 py-2 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isLoadingBrief ? 'Crafting Daily Briefing...' : 'Get AI Daily Brief'}</span>
          </button>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-surface/80 p-4 shadow-lg backdrop-blur flex items-start gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Today&apos;s Strategic Brief
                </span>
                <button
                  onClick={() => setDailyBrief(null)}
                  className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed font-sans">{dailyBrief}</p>
            </div>
          </div>
        )}
      </div>

      {/* Capacity Bar */}
      {totalPlannedMin > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>
              Day capacity: {completedMin}m done / {totalPlannedMin}m planned
            </span>
            <span className={capacityPercent > 100 ? 'text-warning font-semibold' : ''}>
              {capacityPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden border border-border/40">
            <div
              className={cn(
                'h-full transition-all duration-200 rounded-full',
                capacityPercent > 100 ? 'bg-warning' : 'bg-primary'
              )}
              style={{ width: `${Math.min(100, capacityPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Next Up Hero Card */}
      {nextUp ? (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-surface to-[#10101C] p-6 shadow-xl">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                <span>Next Up</span>
              </div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">{nextUp.title}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span style={{ color: nextUp.missionColor }} className="font-semibold">
                  {nextUp.missionTitle}
                </span>
                <span>•</span>
                <span className="font-mono">{nextUp.estimateMin}m estimated</span>
              </div>
            </div>
            <Link
              href={`/lockin?stepId=${nextUp._id}&missionId=${nextUp.missionId}`}
              className="shrink-0"
            >
              <Button className="bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/25 gap-2 text-xs font-medium">
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Lock In Now</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : totalToday === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-[#10101C] p-8 shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No steps scheduled today</h3>
          <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-sm mx-auto">
            Create a mission and plan your runway to see today&apos;s focused task list here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/brain-dump">
              <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Brain Dump to Plan</span>
              </Button>
            </Link>
            <Link href="/missions/new">
              <Button variant="outline" className="text-xs gap-2">
                <span>Manual Mission</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-success/40 bg-success/[0.03] p-6 text-center shadow-sm">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
          <h3 className="text-base font-bold text-success">All done for today!</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Outstanding execution. Streak maintained.
          </p>
        </div>
      )}

      {/* Step List */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s Pipeline
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              {completedToday}/{totalToday} done
            </span>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step._id}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 transition-all hover:border-primary/30 hover:bg-surface-hover',
                  step.status === 'done' && 'opacity-60 border-border/50'
                )}
              >
                <button
                  type="button"
                  onClick={() => handleToggleDone(step._id, step.status)}
                  className="shrink-0"
                >
                  {step.status === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-border group-hover:border-primary/60 transition-colors" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium text-foreground truncate',
                      step.status === 'done' && 'line-through text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-mono">
                    <span style={{ color: step.missionColor }}>{step.missionTitle}</span>
                    <span>•</span>
                    <span>{step.estimateMin}m</span>
                    {step.status === 'doing' && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold text-[10px]">
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                </div>

                {step.status !== 'done' && (
                  <Link
                    href={`/lockin?stepId=${step._id}&missionId=${step.missionId}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-primary hover:bg-primary/10"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
