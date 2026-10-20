'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ParsedPlan, ParsedStep } from '@/lib/templates/parser';
import { confirmAndSavePlanAction } from '@/features/brain-dump/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MoveHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

interface PlanPreviewProps {
  initialPlan: ParsedPlan;
  onBack: () => void;
}

export function PlanPreview({ initialPlan, onBack }: PlanPreviewProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<ParsedPlan>(initialPlan);
  const [isSaving, setIsSaving] = useState(false);

  // Edit mission-level details
  const updateTitle = (val: string) => setPlan((prev) => ({ ...prev, title: val }));
  const updateDescription = (val: string) => setPlan((prev) => ({ ...prev, description: val }));
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
    setIsSaving(true);
    try {
      const res = await confirmAndSavePlanAction(plan);
      if (res.success && res.missionId) {
        toast.success('Mission runway created successfully! Lock in.');
        router.push(`/runway?missionId=${res.missionId}`);
      } else {
        toast.error(res.error || 'Failed to save mission runway.');
      }
    } catch (err: unknown) {
      toast.error('Unexpected error saving plan.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const dailyCapacityMin = plan.hoursPerDay * 60;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Header & Mission Metadata */}
      <div className="rounded-xl border border-border/80 bg-surface/60 p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/50">
          <div className="space-y-1.5 flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Generated Runway Preview
            </div>
            <Input
              value={plan.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="text-2xl font-bold bg-transparent border-none px-0 h-auto focus-visible:ring-0 text-text tracking-tight"
              placeholder="Mission Title"
            />
            <Input
              value={plan.description || ''}
              onChange={(e) => updateDescription(e.target.value)}
              className="text-sm text-muted bg-transparent border-none px-0 h-auto focus-visible:ring-0"
              placeholder="Add strategic mission notes..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack} disabled={isSaving}>
              Back / Edit Input
            </Button>
            <Button
              onClick={handleConfirmAndSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 gap-2"
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

        {/* Global Pipeline Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="bg-bg/60 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted block mb-1">Total Duration</span>
            <div className="flex items-center gap-1.5 font-semibold text-text">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{plan.dayCount} Days</span>
            </div>
          </div>
          <div className="bg-bg/60 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted block mb-1">Daily Work Capacity</span>
            <div className="flex items-center gap-1.5 font-semibold text-text">
              <Clock className="h-4 w-4 text-info" />
              <input
                type="number"
                min={1}
                max={24}
                value={plan.hoursPerDay}
                onChange={(e) => updateHoursPerDay(parseInt(e.target.value, 10) || 4)}
                className="w-12 bg-surface text-text px-1.5 py-0.5 rounded border border-border/80 text-sm font-mono"
              />
              <span className="text-xs text-muted">hrs/day</span>
            </div>
          </div>
          <div className="bg-bg/60 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted block mb-1">Total Steps</span>
            <div className="font-semibold text-text font-mono">
              {plan.days.reduce((acc, d) => acc + d.steps.length, 0)} steps
            </div>
          </div>
          <div className="bg-bg/60 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted block mb-1">Total Workload</span>
            <div className="font-semibold text-text font-mono">
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
              className={`flex flex-col rounded-xl border bg-surface/40 p-4 transition-all duration-200 ${
                isOverloaded
                  ? 'border-warning/50 bg-warning/5'
                  : 'border-border/60 hover:border-border'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-text">
                    Day {day.dayIndex + 1}
                  </span>
                  {isOverloaded && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/15 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" /> Overloaded
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-muted">
                  {dayTotalMin}m / {dailyCapacityMin}m
                </span>
              </div>

              {/* Day Capacity Bar */}
              <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden mb-4">
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
                  <div className="text-center py-8 text-xs text-muted/60 border border-dashed border-border/40 rounded-lg">
                    Rest or buffer day
                  </div>
                ) : (
                  day.steps.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="group relative rounded-lg border border-border/70 bg-surface/90 p-3 shadow-sm hover:border-primary/50 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) =>
                            updateStep(day.dayIndex, sIdx, { title: e.target.value })
                          }
                          className="w-full bg-transparent text-xs font-medium text-text border-none focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                        />
                        <button
                          onClick={() => removeStep(day.dayIndex, sIdx)}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger p-0.5 transition-opacity"
                          title="Delete step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Estimate & Controls */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/30">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted" />
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
                            className="w-11 bg-bg border border-border/60 rounded px-1 py-0.5 text-center font-mono text-[11px] text-text"
                          />
                          <span className="text-muted">min</span>
                        </div>

                        {/* Move day dropdown */}
                        <div className="flex items-center gap-1">
                          <span className="text-muted text-[10px]">Move:</span>
                          <select
                            value={day.dayIndex}
                            onChange={(e) =>
                              moveStepToDay(day.dayIndex, sIdx, parseInt(e.target.value, 10))
                            }
                            className="bg-bg border border-border/60 text-text text-[10px] rounded px-1 py-0.5"
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
                        <div className="text-[10px] text-muted flex items-center gap-1 pl-1">
                          <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
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
                className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-text border border-dashed border-border/50 hover:border-primary/50 rounded-lg py-2 transition-colors"
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
