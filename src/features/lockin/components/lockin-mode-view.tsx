'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Play, Pause, Square, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  actionStartTimeLog,
  actionStopTimeLog,
  actionUpdateStep,
} from '@/features/missions/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LockinStep {
  _id: string;
  missionId: string;
  title: string;
  notes?: string;
  estimateMin: number;
  status: string;
  missionTitle?: string;
  missionColor?: string;
}

interface LockinModeViewProps {
  step: LockinStep | null;
}

type TimerState = 'idle' | 'running' | 'paused';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LockinModeView({ step }: LockinModeViewProps) {
  const router = useRouter();
  const [timerState, setTimerState] = React.useState<TimerState>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [logId, setLogId] = React.useState<string | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStart = async () => {
    if (!step) return;
    startTimeRef.current = Date.now() - elapsed * 1000;

    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    setTimerState('running');

    const res = await actionStartTimeLog(step._id, step.missionId);
    if (res.success && res.data) {
      setLogId(res.data._id);
    }
  };

  const handlePause = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState('paused');

    if (logId) {
      await actionStopTimeLog(logId, elapsed);
      setLogId(null);
    }
  };

  const handleStop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (logId) {
      await actionStopTimeLog(logId, elapsed);
      setLogId(null);
    }

    setElapsed(0);
    setTimerState('idle');
  };

  const handleComplete = async () => {
    if (!step) return;
    setIsCompleting(true);

    if (timerState === 'running' && logId) {
      await actionStopTimeLog(logId, elapsed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const res = await actionUpdateStep(step._id, { status: 'done' });
    setIsCompleting(false);

    if (res.success) {
      toast.success('Step completed! 🎯 Moving on...', { duration: 2000 });
      setTimeout(() => router.push('/today'), 1500);
    } else {
      toast.error('Failed to mark step as done');
    }
  };

  if (!step) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Lock-In Mode</h1>
        <p className="text-xs text-muted-foreground max-w-xs">
          Select a step from Today view or Runway to enter single-focus lock-in mode with a mono
          timer.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => router.push('/today')}
        >
          Return to Today
        </Button>
      </div>
    );
  }

  const estimateSec = step.estimateMin * 60;
  const progress = Math.min(100, (elapsed / Math.max(estimateSec, 1)) * 100);
  const isOvertime = elapsed > estimateSec;

  return (
    <div className="flex flex-col min-h-[80vh] items-center justify-center space-y-8 animate-in fade-in-50">
      {/* Dimmed background overlay hint */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none -z-10" />

      {/* Top exit control */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary fill-current" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Lock-In Mode
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/today')}
          className="text-xs text-muted-foreground gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          <span>Exit</span>
        </Button>
      </div>

      {/* Mission and Step Title */}
      <div className="w-full max-w-2xl space-y-2 text-center">
        {step.missionTitle && (
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: step.missionColor || '#7C5CFF' }}
          >
            {step.missionTitle}
          </p>
        )}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          {step.title}
        </h1>
        <p className="text-sm text-muted-foreground font-mono">{step.estimateMin}m estimated</p>
      </div>

      {/* Big Mono Timer */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'text-7xl sm:text-9xl font-mono font-black tracking-tighter tabular-nums transition-colors',
            timerState === 'running' && !isOvertime && 'text-primary',
            timerState === 'running' && isOvertime && 'text-warning',
            timerState === 'paused' && 'text-muted-foreground',
            timerState === 'idle' && 'text-foreground/60'
          )}
        >
          {formatTime(elapsed)}
        </div>

        {/* Progress Arc */}
        <div className="w-full max-w-xs h-2 bg-surface rounded-full overflow-hidden border border-border/40">
          <div
            className={cn(
              'h-full transition-all duration-1000 rounded-full',
              isOvertime ? 'bg-warning' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          {isOvertime
            ? `+${formatTime(elapsed - estimateSec)} overtime`
            : `${formatTime(estimateSec - elapsed)} remaining`}
        </p>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center gap-4">
        {timerState === 'idle' && (
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/30 gap-2 px-8 text-base font-semibold"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Start</span>
          </Button>
        )}

        {timerState === 'running' && (
          <>
            <Button onClick={handlePause} variant="secondary" size="lg" className="gap-2 text-sm">
              <Pause className="h-4 w-4 fill-current" />
              <span>Pause</span>
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              size="lg"
              className="bg-success/20 border border-success/40 hover:bg-success/30 text-success gap-2 text-sm font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isCompleting ? 'Completing...' : 'Done'}</span>
            </Button>
          </>
        )}

        {timerState === 'paused' && (
          <>
            <Button
              onClick={handleStart}
              size="lg"
              className="bg-primary hover:bg-primary-hover text-white gap-2 text-sm"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Resume</span>
            </Button>
            <Button
              onClick={handleStop}
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Reset</span>
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              size="lg"
              className="bg-success/20 border border-success/40 hover:bg-success/30 text-success gap-2 text-sm font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isCompleting ? 'Completing...' : 'Mark Done'}</span>
            </Button>
          </>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-[11px] text-muted-foreground/60 font-mono">
        Press{' '}
        <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface text-xs">Esc</kbd> to
        exit
      </p>
    </div>
  );
}
