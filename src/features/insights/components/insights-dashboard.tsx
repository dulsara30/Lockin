'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { InsightsData } from '@/server/dal/insights';
import {
  Flame,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Sparkles,
  BarChart2,
  Layers,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface InsightsDashboardProps {
  initialData: InsightsData;
}

export function InsightsDashboard({ initialData }: InsightsDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<InsightsData>(initialData);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleMissionChange = (missionId: string) => {
    if (missionId === 'all') {
      router.push('/insights');
    } else {
      router.push(`/insights?missionId=${missionId}`);
    }
  };

  const selectedMission = data.missionsList?.find((m) => m._id === data.selectedMissionId);

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-cyan" />
            <span>Performance Analytics</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Execution Insights
          </h1>
          {selectedMission && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>Filtered to:</span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedMission.color }}
              />
              <strong className="text-foreground">{selectedMission.title}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mission Filter Dropdown */}
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground font-semibold">Scope:</span>
            <select
              value={data.selectedMissionId || 'all'}
              onChange={(e) => handleMissionChange(e.target.value)}
              className="bg-transparent text-xs text-foreground font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Missions (Global Analytics)</option>
              {data.missionsList?.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <Link href="/today">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-border bg-surface text-foreground hover:bg-surface-hover"
            >
              Today Overview
            </Button>
          </Link>
          <Link href="/brain-dump">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-1.5 shadow-md shadow-primary/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New Pipeline</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Metric Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak Card */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current Streak
            </span>
            <div className="p-2 rounded-xl bg-warning/15 text-warning">
              <Flame className="h-4 w-4 fill-warning" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {data.currentStreak}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Personal best:{' '}
            <strong className="text-foreground font-mono">{data.longestStreak} days</strong>
          </p>
        </div>

        {/* Completion Rate */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="p-2 rounded-xl bg-lime/15 text-lime">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-lime">
              {data.completionRatePercent}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {selectedMission
              ? `For mission "${selectedMission.title}"`
              : `Across ${data.totalMissions} missions`}
          </p>
        </div>

        {/* Planned Workload */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Planned Hours
            </span>
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {data.totalPlannedHours}
            </span>
            <span className="text-xs text-muted-foreground">hrs</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Total pipeline workload</p>
        </div>

        {/* Active Pipelines */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Missions
            </span>
            <div className="p-2 rounded-xl bg-cyan/15 text-cyan">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {data.activeMissions}
            </span>
            <span className="text-xs text-muted-foreground">running</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {data.completedMissions} completed missions
          </p>
        </div>
      </div>

      {/* Burn-Down Curve Chart */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Pipeline Burn-Down Velocity
            </h3>
            <p className="text-xs text-muted-foreground">
              Tracks planned vs actual remaining hours across mission runways.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Ideal Velocity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan" />
              <span className="text-foreground">Actual Remaining</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.burnDownPoints}>
                <defs>
                  <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C5CFF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C5CFF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2DE2E6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#2DE2E6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="dayLabel"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} unit="h" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--foreground)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="idealRemaining"
                  stroke="#7C5CFF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#idealGrad)"
                  name="Ideal Remaining"
                />
                <Area
                  type="monotone"
                  dataKey="actualRemaining"
                  stroke="#2DE2E6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#actualGrad)"
                  name="Actual Remaining"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Loading chart...
            </div>
          )}
        </div>
      </div>

      {/* Grid: Busiest Days & Per-Mission Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Days */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan" />
              Weekly Rhythm & Activity
            </h3>
            <p className="text-xs text-muted-foreground">
              Completed tasks distributed by day of the week.
            </p>
          </div>

          <div className="h-56 w-full pt-2">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.busiestDays}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--foreground)',
                    }}
                  />
                  <Bar
                    dataKey="completedSteps"
                    name="Completed Tasks"
                    fill="#7C5CFF"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Loading rhythm...
              </div>
            )}
          </div>
        </div>

        {/* Per-Mission Progress Rings */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-lime" />
                Mission Runway Progress
              </h3>
              <p className="text-xs text-muted-foreground">
                Completion percentage for active pipelines.
              </p>
            </div>
            <Link href="/missions" className="text-xs text-primary hover:underline font-medium">
              View All
            </Link>
          </div>

          <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
            {data.missionProgressRings.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No active missions yet. Start a new mission runway to view completion rings.
              </div>
            ) : (
              data.missionProgressRings.map((m) => (
                <div
                  key={m.missionId}
                  className="p-3.5 rounded-xl border border-border bg-surface-hover space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-foreground truncate max-w-[200px]">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="truncate">{m.title}</span>
                    </div>
                    <span className="font-mono font-bold text-lime">{m.completionPercent}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-background h-2 rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${m.completionPercent}%`,
                        backgroundColor: m.color || '#7C5CFF',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>
                      {m.completedSteps} / {m.totalSteps} tasks done
                    </span>
                    <span>{(m.plannedMinutes / 60).toFixed(1)}h planned</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
