'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ParsedPlan, ParsedStep } from '@/lib/templates/parser';
import { confirmAndSavePlanAction } from '@/features/brain-dump/actions';
import { actionGetMissions } from '@/features/missions/actions';
import { MissionWithRunway } from '@/features/missions/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
  Settings,
  Route,
} from 'lucide-react';
import { toast } from 'sonner';

const paletteColors = [
  '#7C5CFF', // Violet
  '#2DE2E6', // Cyan
  '#C6FF3D', // Lime
  '#FFB020', // Amber
  '#FF5D73', // Coral
  '#FF61D2', // Pink
  '#38EF7D', // Emerald
];

interface PlanPreviewProps {
  initialPlan: ParsedPlan;
  initialMissionId?: string;
  onBack: () => void;
}

export function PlanPreview({ initialPlan, initialMissionId, onBack }: PlanPreviewProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<ParsedPlan>(initialPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [missionsList, setMissionsList] = useState<MissionWithRunway[]>([]);

  // Mission configuration state in preview
  const [selectedMissionId, setSelectedMissionId] = useState<string>(initialMissionId || 'new');
  const [missionTitle, setMissionTitle] = useState(initialPlan.title);
  const [missionDescription, setMissionDescription] = useState(initialPlan.description || '');
  const [missionColor, setMissionColor] = useState('#7C5CFF');
  const [missionPriority, setMissionPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    'medium'
  );
  const [missionTags, setMissionTags] = useState((initialPlan.tags || []).join(', '));

  // Runway configuration state in preview
  const [runwayTitle, setRunwayTitle] = useState(`${initialPlan.title} Runway`);

  useEffect(() => {
    actionGetMissions().then((res) => {
      if (res.success && res.data) {
        setMissionsList(res.data);
      }
    });
  }, []);

  // Filter only missions that do NOT have a runway yet (1 mission = 1 runway)
  const availableMissions = missionsList.filter((m) => !m.hasRunway);

  // When user switches selected mission from dropdown
  const handleMissionSelectChange = (val: string) => {
    setSelectedMissionId(val);
    if (val !== 'new') {
      const selected = missionsList.find((m) => m._id === val);
      if (selected) {
        setMissionTitle(selected.title);
        setMissionDescription(selected.description || '');
        setMissionColor(selected.color || '#7C5CFF');
        setMissionPriority((selected.priority as any) || 'medium');
        setMissionTags(selected.tags?.join(', ') || '');
        setRunwayTitle(`${selected.title} Runway`);
      }
    } else {
      setMissionTitle(plan.title);
      setMissionDescription(plan.description || '');
      setRunwayTitle(`${plan.title} Runway`);
    }
  };

  const updateHoursPerDay = (val: number) =>
    setPlan((prev) => ({ ...prev, hoursPerDay: Math.max(1, Math.min(24, val)) }));

  // Update step
  const updateStep = (dayIndex: number, stepIdx: number, updates: Partial<ParsedStep>) => {
    setPlan((prev) => {
      const nextDays = [...prev.days];
      const targetDay = nextDays.find((d) => d.dayIndex === dayIndex);
      if (!targetDay) return prev;
      targetDay.steps[stepIdx] = { ...targetDay.steps[stepIdx], ...updates };
      return { ...prev, days: nextDays };
    });
  };

  // Remove step
  const removeStep = (dayIndex: number, stepIdx: number) => {
    setPlan((prev) => {
      const nextDays = [...prev.days];
      const targetDay = nextDays.find((d) => d.dayIndex === dayIndex);
      if (!targetDay) return prev;
      targetDay.steps.splice(stepIdx, 1);
      return { ...prev, days: nextDays };
    });
  };

  // Move step to another day
  const moveStepToDay = (currentDayIndex: number, stepIdx: number, targetDayIndex: number) => {
    if (currentDayIndex === targetDayIndex) return;
    setPlan((prev) => {
      const nextDays = [...prev.days];
      const srcDay = nextDays.find((d) => d.dayIndex === currentDayIndex);
      const destDay = nextDays.find((d) => d.dayIndex === targetDayIndex);
      if (!srcDay || !destDay) return prev;

      const [moved] = srcDay.steps.splice(stepIdx, 1);
      if (moved) {
        destDay.steps.push(moved);
      }
      return { ...prev, days: nextDays };
    });
  };

  // Add step inline to a day
  const addStepToDay = (dayIndex: number) => {
    setPlan((prev) => {
      const nextDays = [...prev.days];
      const targetDay = nextDays.find((d) => d.dayIndex === dayIndex);
      if (!targetDay) return prev;
      targetDay.steps.push({
        title: 'New action item',
        estimateMin: 30,
        priority: 'medium',
        checklist: [],
      });
      return { ...prev, days: nextDays };
    });
  };

  const handleConfirmAndSave = async () => {
    if (!missionTitle.trim()) {
      toast.error('Mission title is required');
      return;
    }

    setIsSaving(true);
    try {
      const parsedTags = missionTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        ...plan,
        title: missionTitle.trim(),
        description: missionDescription.trim(),
        color: missionColor,
        priority: missionPriority,
        tags: parsedTags,
        missionId: selectedMissionId === 'new' ? undefined : selectedMissionId,
        runwayTitle: runwayTitle.trim() || `${missionTitle.trim()} Runway`,
      };

      const res = await confirmAndSavePlanAction(payload);
      if (res.success && res.missionId) {
        toast.success('Mission runway pipeline configured! Directing to runway...');
        router.push(`/runway?missionId=${res.missionId}`);
      } else {
        toast.error(res.error || 'Failed to save mission runway.');
      }
    } catch {
      toast.error('Unexpected error saving plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const dailyCapacityMin = plan.hoursPerDay * 60;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Top Header & Confirmation Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <Sparkles className="h-3.5 w-3.5 text-cyan" />
            <span>Plan Review & Configuration</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Configure Mission & Runway Plan
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Refine mission metadata and review the day-by-day sequenced runway before locking in.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isSaving}
            className="border-border bg-surface text-foreground hover:bg-surface-hover text-xs"
          >
            Back / Edit Input
          </Button>
          <Button
            onClick={handleConfirmAndSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-lg shadow-primary/25 gap-2 px-5"
          >
            {isSaving ? (
              'Building Runway...'
            ) : (
              <>
                Confirm & Lock In <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 1. Mission Configuration Section */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Mission Setup & Assignment</h3>
          </div>
          <span className="text-xs text-muted-foreground">Step 1 of 2</span>
        </div>

        {/* Destination: New or Existing Mission without runway */}
        <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2">
          <Label className="text-xs font-semibold text-primary">Destination Mission</Label>
          <select
            value={selectedMissionId}
            onChange={(e) => handleMissionSelectChange(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-semibold focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="new">+ Create New Mission with this Plan</option>
            {availableMissions.map((m) => (
              <option key={m._id} value={m._id}>
                Attach to Existing Mission: {m.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {selectedMissionId === 'new'
              ? 'A new mission will be created using the details below, and this runway will be attached to it.'
              : 'This runway will be added to the selected existing mission. (A mission cannot have multiple runways).'}
          </p>
        </div>

        {/* Mission Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Mission Title</Label>
              <Input
                value={missionTitle}
                onChange={(e) => setMissionTitle(e.target.value)}
                placeholder="e.g. Launch V1 Product"
                className="text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Runway Name</Label>
              <Input
                value={runwayTitle}
                onChange={(e) => setRunwayTitle(e.target.value)}
                placeholder="e.g. Core Build Runway"
                className="text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mission Description / Strategy</Label>
            <textarea
              value={missionDescription}
              onChange={(e) => setMissionDescription(e.target.value)}
              rows={2}
              placeholder="Strategic mission deliverables and focus areas..."
              className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <select
                value={missionPriority}
                onChange={(e) => setMissionPriority(e.target.value as any)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground capitalize font-medium focus:outline-none focus:border-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2 pt-1">
                {paletteColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setMissionColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      missionColor === c
                        ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-background'
                        : 'opacity-70 hover:opacity-100 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                value={missionTags}
                onChange={(e) => setMissionTags(e.target.value)}
                placeholder="dev, urgent, launch"
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Runway Plan Execution Metrics */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-cyan" />
            <h3 className="text-sm font-bold text-foreground">Runway Timeline & Daily Workload</h3>
          </div>
          <span className="text-xs text-muted-foreground">Step 2 of 2</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-background p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Total Duration</span>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{plan.dayCount} Days</span>
            </div>
          </div>
          <div className="bg-background p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Daily Work Capacity</span>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Clock className="h-4 w-4 text-info" />
              <input
                type="number"
                min={1}
                max={24}
                value={plan.hoursPerDay}
                onChange={(e) => updateHoursPerDay(parseInt(e.target.value, 10) || 4)}
                className="w-14 bg-surface text-foreground px-2 py-0.5 rounded-md border border-border text-sm font-mono"
              />
              <span className="text-xs text-muted-foreground">hrs/day</span>
            </div>
          </div>
          <div className="bg-background p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Total Steps</span>
            <div className="font-semibold text-foreground font-mono text-base">
              {plan.days.reduce((acc, d) => acc + d.steps.length, 0)} steps
            </div>
          </div>
          <div className="bg-background p-3.5 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">Total Workload</span>
            <div className="font-semibold text-foreground font-mono text-base">
              {Math.round(
                (plan.days.reduce(
                  (acc, d) => acc + d.steps.reduce((sAcc, s) => sAcc + s.estimateMin, 0),
                  0
                ) /
                  60) *
                  10
              ) / 10}{' '}
              hours
            </div>
          </div>
        </div>
      </div>

      {/* Runway Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plan.days.map((day) => {
          const dayTotalMin = day.steps.reduce((acc, s) => acc + s.estimateMin, 0);
          const isOverloaded = dayTotalMin > dailyCapacityMin;
          const pctCapacity = Math.min(100, Math.round((dayTotalMin / dailyCapacityMin) * 100));

          return (
            <div
              key={day.dayIndex}
              className={`flex flex-col rounded-2xl border p-4 transition-all duration-200 ${
                isOverloaded ? 'border-warning/60 bg-surface' : 'border-border bg-surface'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-foreground">
                    Day {day.dayIndex + 1}
                  </span>
                  {isOverloaded && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-3 w-3" /> Overloaded
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {dayTotalMin}m / {dailyCapacityMin}m
                </span>
              </div>

              {/* Day Capacity Bar */}
              <div className="w-full bg-background h-1.5 rounded-full overflow-hidden mb-4 border border-border">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isOverloaded ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${pctCapacity}%` }}
                />
              </div>

              {/* Steps List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
                {day.steps.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Rest or buffer day
                  </div>
                ) : (
                  day.steps.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="group relative rounded-xl border border-border bg-background p-3 shadow-sm hover:border-primary/50 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) =>
                            updateStep(day.dayIndex, sIdx, { title: e.target.value })
                          }
                          className="w-full bg-transparent text-xs font-semibold text-foreground border-none focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                        />
                        <button
                          onClick={() => removeStep(day.dayIndex, sIdx)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger p-0.5 transition-opacity"
                          title="Delete step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Estimate & Controls */}
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-info" />
                          <input
                            type="number"
                            min={5}
                            step={5}
                            value={step.estimateMin}
                            onChange={(e) =>
                              updateStep(day.dayIndex, sIdx, {
                                estimateMin: Math.max(5, parseInt(e.target.value, 10) || 5),
                              })
                            }
                            className="w-12 bg-surface border border-border rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-foreground"
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>

                        {/* Move day dropdown */}
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-[10px]">Move:</span>
                          <select
                            value={day.dayIndex}
                            onChange={(e) =>
                              moveStepToDay(day.dayIndex, sIdx, parseInt(e.target.value, 10))
                            }
                            className="bg-surface border border-border text-foreground text-[10px] rounded px-1.5 py-0.5 font-medium"
                          >
                            {plan.days.map((d) => (
                              <option key={d.dayIndex} value={d.dayIndex}>
                                D{d.dayIndex + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Subtasks summary if present */}
                      {step.checklist && step.checklist.length > 0 && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 pl-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          <span>{step.checklist.length} subtasks</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Step Button */}
              <button
                onClick={() => addStepToDay(day.dayIndex)}
                className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 hover:bg-surface rounded-xl py-2 transition-colors font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Add Step
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
