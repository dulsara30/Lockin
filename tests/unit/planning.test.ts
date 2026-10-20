import { describe, it, expect } from 'vitest';
import {
  calculateDayCapacity,
  calculateMissionHealth,
  previewRollover,
  StepSummary,
} from '@/lib/planning';

describe('Mission Health & Capacity Pure Engine', () => {
  it('correctly calculates day capacity and identifies overloading', () => {
    const steps: StepSummary[] = [
      { estimateMin: 120, status: 'done', dayIndex: 0 },
      { estimateMin: 90, status: 'doing', dayIndex: 0 },
      { estimateMin: 60, status: 'todo', dayIndex: 0 },
    ];

    // Total = 270 min > 240 min capacity
    const day0 = calculateDayCapacity(steps, 0, 240);
    expect(day0.plannedMin).toBe(270);
    expect(day0.completedMin).toBe(120);
    expect(day0.remainingMin).toBe(150);
    expect(day0.isOverloaded).toBe(true);
    expect(day0.isCompleted).toBe(false);
    expect(day0.percentageUsed).toBe(113);
  });

  it('marks day as completed when all steps are done or skipped', () => {
    const steps: StepSummary[] = [
      { estimateMin: 60, status: 'done', dayIndex: 1 },
      { estimateMin: 45, status: 'skipped', dayIndex: 1 },
    ];

    const day1 = calculateDayCapacity(steps, 1, 240);
    expect(day1.isCompleted).toBe(true);
    expect(day1.isOverloaded).toBe(false);
    expect(day1.remainingMin).toBe(0);
  });

  it('returns "On track" when remaining work is well within remaining capacity', () => {
    // 5 days, 4h/day = 1200m capacity. Day 0. Remaining capacity = 1200m.
    // Remaining estimate = 500m (ratio = 500/1200 = 0.41 <= 0.85).
    const steps: StepSummary[] = [
      { estimateMin: 100, status: 'todo', dayIndex: 0 },
      { estimateMin: 200, status: 'todo', dayIndex: 1 },
      { estimateMin: 200, status: 'todo', dayIndex: 2 },
    ];

    const health = calculateMissionHealth({
      steps,
      dayCount: 5,
      currentDayIndex: 0,
      dailyCapacityMin: 240,
    });

    expect(health.health).toBe('On track');
    expect(health.remainingEstimateMin).toBe(500);
    expect(health.overloadedDayIndices).toHaveLength(0);
  });

  it('returns "At risk" when remaining workload is tightly packed (between 85% and 115%)', () => {
    // 2 days remaining (dayIndex 3 of 5). Remaining capacity = 2 * 240 = 480m.
    // Remaining estimate = 450m (ratio = 450/480 = 93.75%).
    const steps: StepSummary[] = [
      { estimateMin: 240, status: 'done', dayIndex: 0 },
      { estimateMin: 240, status: 'done', dayIndex: 1 },
      { estimateMin: 240, status: 'done', dayIndex: 2 },
      { estimateMin: 225, status: 'todo', dayIndex: 3 },
      { estimateMin: 225, status: 'todo', dayIndex: 4 },
    ];

    const health = calculateMissionHealth({
      steps,
      dayCount: 5,
      currentDayIndex: 3,
      dailyCapacityMin: 240,
    });

    expect(health.health).toBe('At risk');
    expect(health.remainingEstimateMin).toBe(450);
  });

  it('returns "Behind" when remaining workload exceeds capacity by > 15%', () => {
    // 1 day remaining (dayIndex 4 of 5). Remaining capacity = 240m.
    // Remaining estimate = 400m (ratio = 400/240 = 166% > 115%).
    const steps: StepSummary[] = [
      { estimateMin: 200, status: 'todo', dayIndex: 4 },
      { estimateMin: 200, status: 'todo', dayIndex: 4 },
    ];

    const health = calculateMissionHealth({
      steps,
      dayCount: 5,
      currentDayIndex: 4,
      dailyCapacityMin: 240,
    });

    expect(health.health).toBe('Behind');
  });

  it('returns "Completed" when all tasks in mission are finished', () => {
    const steps: StepSummary[] = [
      { estimateMin: 120, status: 'done', dayIndex: 0 },
      { estimateMin: 60, status: 'done', dayIndex: 1 },
      { estimateMin: 45, status: 'skipped', dayIndex: 2 },
    ];

    const health = calculateMissionHealth({
      steps,
      dayCount: 3,
      currentDayIndex: 2,
    });

    expect(health.health).toBe('Completed');
    expect(health.completionRatePercent).toBe(100);
    expect(health.remainingEstimateMin).toBe(0);
  });

  it('previews rollover accurately before modifying state', () => {
    const steps = [
      { id: '1', estimateMin: 90, status: 'todo' as const, dayIndex: 0 }, // past unfinished
      { id: '2', estimateMin: 120, status: 'done' as const, dayIndex: 0 },
      { id: '3', estimateMin: 180, status: 'todo' as const, dayIndex: 1 }, // today
    ];

    // Current day is 1, rolling over unfinished work from day 0 to day 1
    const preview = previewRollover({
      steps,
      currentDayIndex: 1,
      targetDayIndex: 1,
      dayCount: 3,
      dailyCapacityMin: 240,
    });

    expect(preview.stepsToMove).toHaveLength(1);
    expect(preview.stepsToMove[0]).toEqual({
      id: '1',
      fromDay: 0,
      toDay: 1,
    });
    // Day 1 before: 180m; Day 1 after: 180 + 90 = 270m (> 240m, overloaded)
    expect(preview.targetDayCapacityBefore.plannedMin).toBe(180);
    expect(preview.targetDayCapacityAfter.plannedMin).toBe(270);
    expect(preview.targetDayCapacityAfter.isOverloaded).toBe(true);
  });
});
