'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Compass,
  Target,
  Route,
  Clock,
  Sparkles,
  RotateCw,
  Lock,
  BarChart2,
  CheckCircle2,
  ArrowRight,
  Play,
  AlertTriangle,
  Layers,
  Calendar,
  Flame,
  Check,
  ChevronRight,
  ListTodo,
  FileCode,
  Sliders,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeatureTab {
  id: string;
  name: string;
  tagline: string;
  icon: React.ElementType;
  color: string;
  description: string;
  whatItDoes: string[];
  howItWorks: string[];
  systemAction: string;
  actionUrl: string;
  actionLabel: string;
}

const FEATURES: FeatureTab[] = [
  {
    id: 'missions',
    name: '1. Missions',
    tagline: 'High-Level Objectives & Project Containers',
    icon: Target,
    color: 'text-primary',
    description:
      'A Mission is the root container representing an overarching project, goal, or sprint milestone. A runway cannot exist without a mission.',
    whatItDoes: [
      'Establishes the deadline, priority level, and target day span (e.g. 5 days, 14 days).',
      'Acts as the single source of truth for overall workload capacity and milestone delivery.',
      'Tracks total completed vs planned minutes and health status (On track / At risk / Behind).',
    ],
    howItWorks: [
      'Create a mission manually with custom color and priority, or let AI generate one from a Brain Dump.',
      'All daily tasks and execution runways are strictly owned by their parent mission.',
      'Deleting a mission safely removes all associated runways and tasks with confirmation.',
    ],
    systemAction:
      'The data-access layer enforces that every single query requires a userId (the mission owner workspace) and missionId, ensuring total tenant isolation and preventing orphan tasks. Collaborators reach an owner mission only through an explicit, revocable grant.',
    actionUrl: '/missions/new',
    actionLabel: 'Create a Mission',
  },
  {
    id: 'runways',
    name: '2. Runway Pipelines',
    tagline: 'Multi-Day Sequenced Execution Roadmaps with Versioning',
    icon: Route,
    color: 'text-cyan',
    description:
      'A Runway translates a broad mission goal into a realistic, day-by-day sequenced execution pipeline that respects your personal daily work hours.',
    whatItDoes: [
      'Divides remaining work into daily columns balanced against your daily capacity (e.g. 8.0h/day).',
      'Calculates real-time percentage utilization for every individual day to prevent burnout.',
      'Supports Versioning: Original v1 is permanently preserved when you create re-planned versions.',
    ],
    howItWorks: [
      'Tasks are arranged chronologically using fractional-indexing for instantaneous reordering.',
      'Drag and drop tasks between day columns to redistribute workload in real time.',
      'Switch between Runway versions (Original v1 vs Replan v2/v3) directly from the pipeline header.',
    ],
    systemAction:
      'The planning engine calculates day-by-day capacity limits and automatically turns columns amber if planned minutes exceed daily work hours.',
    actionUrl: '/runway',
    actionLabel: 'Open Runway Hub',
  },
  {
    id: 'day-focus',
    name: '3. Day Focus & 24h Clock',
    tagline: 'Dedicated 4-Lane Status Pipeline with Timed Execution',
    icon: Clock,
    color: 'text-warning',
    description:
      'Clicking any day in your runway opens a dedicated, full-screen day focus pipeline with 4 status columns and an active 24-hour completion clock.',
    whatItDoes: [
      'Provides a dedicated Kanban board with official statuses: To Do, In Progress, Blocked, Done.',
      'Enforces a strict 24-hour completion clock once a day is started.',
      'Displays a live countdown: exact hours and minutes remaining before the day window expires.',
    ],
    howItWorks: [
      'Click "Start Day" — a confirmation dialog explains the 24-hour commitment before activating.',
      'Drag cards smoothly across To Do, In Progress, Blocked, and Done with instant optimistic updates.',
      'If 24 hours expire with unfinished tasks, the day is flagged as Overdue and flags a schedule drag.',
    ],
    systemAction:
      'The system records timestamped day activations in the database and monitors for schedule drag, alerting you on your insights dashboard and runway headers.',
    actionUrl: '/runway',
    actionLabel: 'Launch Day Pipeline',
  },
  {
    id: 'brain-dump',
    name: '4. AI Brain Dump & Templates',
    tagline: 'Transform Chaotic Thoughts into Sequenced Plans',
    icon: Sparkles,
    color: 'text-lime',
    description:
      'Turn messy thought dumps, voice transcripts, or markdown checklists into atomic, sequenced 15–60 minute actionable steps.',
    whatItDoes: [
      'AI Mode (Gemini): Analyzes unstructured text and chunks tasks logically across days.',
      'Template Mode: Parses Markdown checklists, JSON blueprints, or bullet points completely offline.',
      'Interactive Preview: Customize task titles, durations, and day assignments before saving.',
    ],
    howItWorks: [
      'Enter what you want to achieve or import an existing checklist.',
      'Choose your target timeline (days) and daily working hours (defaults to your profile settings).',
      'Review the structured runway preview, select or create a mission, and deploy in one click.',
    ],
    systemAction:
      'Inputs are validated with strict Zod schemas on the server, and tasks are tagged with fractional-index keys for conflict-free drag-and-drop sequencing.',
    actionUrl: '/brain-dump',
    actionLabel: 'Try AI Brain Dump',
  },
  {
    id: 'replan',
    name: '5. AI Re-planning & Feasibility',
    tagline: 'Intelligent Schedule Re-balancing & Overload Detection',
    icon: RotateCw,
    color: 'text-primary',
    description:
      'When unexpected delays occur or days exceed the 24h limit, Lockin re-calculates remaining unfinished tasks and balances them across remaining days.',
    whatItDoes: [
      'Preserves all completed tasks untouched — only redistributes unfinished and blocked steps.',
      'Feasibility Analysis: Detects if remaining work exceeds available standard working hours.',
      'Calculates exact overload metrics: Option A (+X extra days needed) or Option B (+Y hours/day overwork).',
    ],
    howItWorks: [
      'Click "Re-plan" on any active runway experiencing schedule drag or overload.',
      'Gemini analyzes remaining estimates against your daily capacity and outputs a re-balanced preview.',
      'Saving creates a new Runway Version (e.g. v2 Replan) while keeping your original baseline intact.',
    ],
    systemAction:
      'The feasibility engine compares remaining work against remaining days and alerts you with clear options if the deadline cannot be met with standard capacity.',
    actionUrl: '/runway',
    actionLabel: 'Test Re-plan Engine',
  },
  {
    id: 'lockin-mode',
    name: '6. Lock-in Focus Mode',
    tagline: 'Distraction-Free Deep Work Execution Environment',
    icon: Lock,
    color: 'text-info',
    description:
      'A zen-mode fullscreen interface built for executing single steps without notification distractions or cognitive overload.',
    whatItDoes: [
      'Displays one task at a time with a prominent interactive stopwatch / Pomodoro timer.',
      'Provides an in-flight interactive checklist for micro-milestones inside the task.',
      'Features a quick scratchpad for spontaneous thoughts so you do not break focus.',
    ],
    howItWorks: [
      'Click "Lock In" on any step from your Today view or runway pipeline drawer.',
      'Start the timer: elapsed seconds automatically record into your persistent time logs.',
      'Check off sub-items, mark the step as Done, and seamlessly advance to the next queued step.',
    ],
    systemAction:
      'Time logs record duration down to the second, linking directly to stepId and missionId to populate your actual vs planned analytics.',
    actionUrl: '/today',
    actionLabel: 'Enter Focus Mode',
  },
  {
    id: 'insights',
    name: '7. Performance Analytics',
    tagline: 'Velocity Burn-Down, Streaks & Drag Detection',
    icon: BarChart2,
    color: 'text-cyan',
    description:
      'Comprehensive telemetry on your execution velocity, actual vs estimated accuracy, day consistency streaks, and schedule drag alerts.',
    whatItDoes: [
      'Interactive Velocity Burn-Down Curve: Compares ideal trajectory against actual remaining workload.',
      'Current & Longest Streak Counters: Rewards consistent daily execution.',
      'Schedule Drag Alert: Explicitly warns when days have exceeded their 24h completion limits.',
    ],
    howItWorks: [
      'Filter analytics globally across all missions or scope to a single active mission.',
      'Analyze busiest weekdays to identify peak productivity windows.',
      'Track accuracy ratios to improve future time estimation habits.',
    ],
    systemAction:
      'Aggregates activity logs and step updates across all user documents to generate high-performance Recharts visualizations.',
    actionUrl: '/insights',
    actionLabel: 'View Analytics',
  },
  {
    id: 'sharing',
    name: '8. Sharing & Roles',
    tagline: 'Collaborate on a Mission with Least-Privilege Access',
    icon: Users,
    color: 'text-primary',
    description:
      'Share any mission you own with other Lockin users by email. Each person gets exactly one role, and the owner can change or revoke it at any time.',
    whatItDoes: [
      'Owner: full control, including sharing, changing roles, removing people, archiving and deleting.',
      'Can edit: do everything in the mission (steps, runways, re-plans, time tracking) except manage people, archive or delete it.',
      'Can view: see the exact same UI in read-only mode. All controls are disabled and every write is rejected by the server.',
    ],
    howItWorks: [
      'Open a mission, click Share, enter the email of a teammate (they need a Lockin account), and pick Can view or Can edit.',
      'Use the Missions page filters: My Missions shows what you own, Shared with me shows what others gave you.',
      'Owners see every member in the dialog, can switch roles instantly or remove someone; members can leave on their own.',
    ],
    systemAction:
      'Permissions are re-checked on the server for every single request (never trusted from the browser or cached in the session), so removing someone takes effect immediately. Non-members get "not found" so private missions are never revealed. Membership changes are written to the activity log.',
    actionUrl: '/missions',
    actionLabel: 'Open Missions',
  },
];

export function HowItWorksView() {
  const [selectedFeature, setSelectedFeature] = React.useState<FeatureTab>(FEATURES[0]);
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);

  const stepsList = [
    {
      num: '01',
      title: 'Define your Mission',
      desc: 'Set the broad goal, priority, and deadline. This serves as the container for all execution work.',
    },
    {
      num: '02',
      title: 'Generate or Import Runway',
      desc: 'Use AI Brain Dump or templates to automatically map tasks into daily capacity-balanced columns.',
    },
    {
      num: '03',
      title: 'Start your Day (24h Clock)',
      desc: 'Commit to the current day. A strict 24-hour countdown begins to finish scheduled items.',
    },
    {
      num: '04',
      title: 'Lock In & Execute',
      desc: 'Move tasks across To Do, In Progress, and Done. Use fullscreen Lock-in mode for deep work.',
    },
    {
      num: '05',
      title: 'Re-plan if Overdue',
      desc: 'If 24h lapses or life happens, use AI Re-plan to re-balance remaining work into a new version.',
    },
    {
      num: '06',
      title: 'Share & Collaborate',
      desc: 'Invite teammates by email as editors or viewers. Change or revoke access whenever you want.',
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <Compass className="h-3.5 w-3.5" />
          <span>Interactive System Architecture & Guide</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          How Lockin Works
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Lockin is an opinionated execution system that replaces chaotic to-do lists with balanced,
          multi-day runway pipelines, timed 24-hour day commitments, and intelligent AI re-planning.
        </p>
      </div>

      {/* Core Concept: Hierarchy Strip */}
      <div className="p-6 rounded-3xl border border-border bg-surface/70 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span>The Lockin Data Hierarchy</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">Strict 1:N Structure</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Level 1: Mission */}
          <div className="p-4 rounded-2xl border border-primary/40 bg-primary/5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">
                Level 1
              </span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">Mission</h3>
            <p className="text-xs text-muted-foreground">
              The high-level objective with deadline, priority, and overall health status.
            </p>
          </div>

          {/* Level 2: Runway */}
          <div className="p-4 rounded-2xl border border-cyan/40 bg-cyan/5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan font-bold">
                Level 2
              </span>
              <Route className="h-4 w-4 text-cyan" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">Runway</h3>
            <p className="text-xs text-muted-foreground">
              The sequenced multi-day roadmap. Supports multiple versions (Original vs Re-plans).
            </p>
          </div>

          {/* Level 3: Day */}
          <div className="p-4 rounded-2xl border border-warning/40 bg-warning/5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-warning font-bold">
                Level 3
              </span>
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">Day Window</h3>
            <p className="text-xs text-muted-foreground">
              A 24-hour execution clock with daily capacity limits and 4 status columns.
            </p>
          </div>

          {/* Level 4: Step */}
          <div className="p-4 rounded-2xl border border-lime/40 bg-lime/5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-lime font-bold">
                Level 4
              </span>
              <CheckCircle2 className="h-4 w-4 text-lime" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">Step / Task</h3>
            <p className="text-xs text-muted-foreground">
              Atomic 15–60 min units with checklists, time estimates, notes, and Pomodoro timer.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Feature Explorer */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Explore Core Features
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click through each core system component to see how it operates and what the engine
            does.
          </p>
        </div>

        {/* Feature Navigation Pills */}
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            const isSelected = selectedFeature.id === feat.id;

            return (
              <button
                key={feat.id}
                onClick={() => setSelectedFeature(feat)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border select-none',
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/25 scale-[1.02]'
                    : 'bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground border-border'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-white' : feat.color)} />
                <span>{feat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Detailed Feature Showcase Panel */}
        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-xl space-y-6 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
                <selectedFeature.icon className={cn('h-4 w-4', selectedFeature.color)} />
                <span>{selectedFeature.name}</span>
              </div>
              <h3 className="text-2xl font-extrabold text-foreground">{selectedFeature.tagline}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed pt-1">
                {selectedFeature.description}
              </p>
            </div>

            <Link href={selectedFeature.actionUrl}>
              <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/20 shrink-0">
                <span>{selectedFeature.actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: What It Does */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-lime" />
                <span>What It Does for You</span>
              </h4>
              <ul className="space-y-2.5">
                {selectedFeature.whatItDoes.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: How It Operates */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan" />
                <span>How the Workflow Operates</span>
              </h4>
              <ul className="space-y-2.5">
                {selectedFeature.howItWorks.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Under the Hood System Callout */}
          <div className="p-4 rounded-2xl bg-background/80 border border-border/80 flex items-start gap-3 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="text-foreground block font-semibold">
                Under the Hood / System Rules:
              </strong>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                {selectedFeature.systemAction}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Interactive Workflow */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            The 5-Step Operator Journey
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How to take any complex project from raw idea to 100% completion with Lockin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stepsList.map((step, idx) => {
            const isCurrent = activeStepIndex === idx;

            return (
              <div
                key={step.num}
                onClick={() => setActiveStepIndex(idx)}
                className={cn(
                  'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 select-none',
                  isCurrent
                    ? 'bg-surface border-primary ring-2 ring-primary/40 shadow-lg'
                    : 'bg-surface/50 border-border hover:border-border/80'
                )}
              >
                <div>
                  <span
                    className={cn(
                      'text-lg font-black font-mono block',
                      isCurrent ? 'text-primary' : 'text-muted-foreground/60'
                    )}
                  >
                    {step.num}
                  </span>
                  <h4 className="text-xs font-bold text-foreground mt-1">{step.title}</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-surface to-background p-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-foreground">Ready to Lock In?</h3>
          <p className="text-xs text-muted-foreground max-w-xl">
            Start by dumping your goals into AI Brain Dump or creating a new Mission to sequence
            your execution runway.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 shrink-0">
          <Link href="/brain-dump">
            <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-md shadow-primary/25">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Launch Brain Dump</span>
            </Button>
          </Link>
          <Link href="/missions/new">
            <Button variant="outline" className="border-border bg-surface text-xs gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span>Create Mission</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
