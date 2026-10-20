'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Route,
  Target,
  Plus,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MissionWithRunway } from '@/features/missions/types';

interface RunwayMissionSelectorProps {
  missions: MissionWithRunway[];
}

export function RunwayMissionSelector({ missions }: RunwayMissionSelectorProps) {
  const router = useRouter();

  const getHealthBadge = (health?: string) => {
    switch (health) {
      case 'On track':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success/20 text-success border border-success/30">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span>On track</span>
          </span>
        );
      case 'At risk':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/20 text-warning border border-warning/30">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span>At risk</span>
          </span>
        );
      case 'Behind':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-danger/20 text-danger border border-danger/30">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" />
            <span>Behind</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-info/20 text-info border border-info/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <Route className="h-3.5 w-3.5 text-cyan" />
            <span>Pipeline Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Runway Missions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a mission to launch its sequenced day-by-day execution pipeline and capacity
            tracker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/missions/new">
            <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20">
              <Plus className="h-3.5 w-3.5" />
              <span>New Mission</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid of Mission Cards with KPIs */}
      {missions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">A runway requires a mission</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-6">
            A runway cannot exist without a mission. Create your first mission to initialize your
            sequenced execution runway.
          </p>
          <Link href="/missions/new">
            <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-2 shadow-md shadow-primary/25">
              <Plus className="h-4 w-4" />
              <span>Create Your First Mission</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {missions.map((mission) => {
            const hasRunway = !!mission.hasRunway;
            const stepCount = mission.stepCount ?? 0;
            const completedCount = mission.completedStepCount ?? 0;
            const pct =
              mission.completionRatePercent ??
              (stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0);
            const totalHours = Math.round(((mission.totalEstimateMin ?? 0) / 60) * 10) / 10;
            const completedHours = Math.round(((mission.completedEstimateMin ?? 0) / 60) * 10) / 10;

            return (
              <div
                key={mission._id}
                onClick={() => {
                  if (hasRunway) {
                    router.push(`/runway?missionId=${mission._id}`);
                  } else {
                    router.push(`/missions/${mission._id}`);
                  }
                }}
                className="group cursor-pointer relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 flex flex-col justify-between"
              >
                {/* Top Accent Color Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: mission.color || '#7C5CFF' }}
                />

                <div className="space-y-4">
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {mission.title}
                      </h3>
                      {mission.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {mission.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                      {mission.priority}
                    </span>
                  </div>

                  {/* Status & Health Badges */}
                  <div className="flex items-center gap-2">
                    {hasRunway ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        <Route className="h-3 w-3" />
                        <span>{mission.runway?.dayCount || mission.dayCount}d Runway</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                        <span>No Runway Yet</span>
                      </span>
                    )}

                    {hasRunway && getHealthBadge(mission.health)}
                  </div>

                  {/* KPI Metrics Strip */}
                  {hasRunway ? (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs font-mono">
                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">
                          Tasks Done
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-lime" />
                          <span>
                            {completedCount} / {stepCount}
                          </span>
                        </div>
                      </div>

                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">
                          Planned Hours
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Clock className="h-3.5 w-3.5 text-info" />
                          <span>
                            {completedHours}h / {totalHours}h
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-border/70 bg-background/30 text-center text-xs text-muted-foreground">
                      Mission is active without a runway. Click to create a runway pipeline.
                    </div>
                  )}

                  {/* Progress Bar */}
                  {hasRunway && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Pipeline Progress</span>
                        <span className="font-bold text-foreground">{pct}%</span>
                      </div>
                      <div className="w-full bg-background h-2 rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                  <span
                    suppressHydrationWarning
                    className="text-[11px] font-mono text-muted-foreground"
                  >
                    Due {new Date(mission.deadline).toISOString().split('T')[0]}
                  </span>

                  {hasRunway ? (
                    <span className="text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      <span>Launch Pipeline</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      <span>Create Runway</span>
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
