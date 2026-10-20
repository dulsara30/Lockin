'use client';

import * as React from 'react';
import { Flame, Clock, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TodayView() {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-base">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Calendar className="h-3.5 w-3.5" />
            <span>Today&apos;s Dispatch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Focus & Pipeline
          </h1>
        </div>

        {/* Streak counter & capacity indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm">
            <Flame className="h-4 w-4 text-warning fill-warning" />
            <span className="text-xs font-bold text-foreground">0 Day Streak</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm">
            <Clock className="h-4 w-4 text-info" />
            <span className="text-xs font-mono text-muted-foreground">0.0h / 4.0h</span>
          </div>
        </div>
      </div>

      {/* Hero Next Up Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-hover/50 p-6 shadow-xl">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              <span>Next Up to Execute</span>
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Ready to initialize your next big task?
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Lockin breaks massive initiatives into sequenced daily lanes. Enter Brain Dump or
              import a checklist to create your first pipeline.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Button
              className="bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/25 rounded-xl text-xs font-medium"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('lockin:open-command'));
              }}
            >
              Open Command Palette (⌘K)
            </Button>
          </div>
        </div>
      </div>

      {/* Capacity & Steps Lane Container */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Scheduled for Today
          </h3>
          <span className="text-xs font-mono text-muted-foreground">0 tasks planned</span>
        </div>

        {/* Empty State */}
        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface border border-border text-muted-foreground mb-4">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <h4 className="text-base font-semibold text-foreground">No steps due today</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            You&apos;re completely clear. Add a new mission or use the Runway view to plan your
            upcoming week.
          </p>
        </div>
      </div>
    </div>
  );
}
