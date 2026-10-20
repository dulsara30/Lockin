export type StepStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'skipped';
export type MissionHealth = 'On track' | 'At risk' | 'Behind' | 'Completed';

export interface StepSummary {
  estimateMin: number;
  status: StepStatus;
  dayIndex: number;
}

export interface DayCapacity {
  dayIndex: number;
  plannedMin: number;
  completedMin: number;
  remainingMin: number;
  capacityMin: number;
  isOverloaded: boolean;
  isCompleted: boolean;
  percentageUsed: number;
}

export interface MissionHealthResult {
  health: MissionHealth;
  totalEstimateMin: number;
  remainingEstimateMin: number;
  completedEstimateMin: number;
  remainingCapacityMin: number;
  totalCapacityMin: number;
  completionRatePercent: number;
  overloadedDayIndices: number[];
  recommendation: string;
}

/**
 * Calculates capacity breakdown for a specific day column.
 */
export function calculateDayCapacity(
  steps: StepSummary[],
  dayIndex: number,
  capacityMin: number = 240 // 4 hours default
): DayCapacity {
  const daySteps = steps.filter((s) => s.dayIndex === dayIndex);
  const plannedMin = daySteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);
  const completedMin = daySteps
    .filter((s) => s.status === 'done')
    .reduce((acc, s) => acc + (s.estimateMin || 0), 0);
  const remainingMin = daySteps
    .filter((s) => s.status !== 'done' && s.status !== 'skipped')
    .reduce((acc, s) => acc + (s.estimateMin || 0), 0);

  const isCompleted =
    daySteps.length > 0 && daySteps.every((s) => s.status === 'done' || s.status === 'skipped');

  const isOverloaded = plannedMin > capacityMin;
  const percentageUsed = capacityMin > 0 ? Math.round((plannedMin / capacityMin) * 100) : 0;

  return {
    dayIndex,
    plannedMin,
    completedMin,
    remainingMin,
    capacityMin,
    isOverloaded,
    isCompleted,
    percentageUsed,
  };
}

/**
 * Pure function computing Mission health badge: On track / At risk / Behind / Completed.
 * Compares remaining estimate against remaining capacity until deadline.
 */
export function calculateMissionHealth({
  steps,
  dayCount,
  currentDayIndex = 0,
  dailyCapacityMin = 240,
}: {
  steps: StepSummary[];
  dayCount: number;
  currentDayIndex?: number;
  dailyCapacityMin?: number;
}): MissionHealthResult {
  const validDayCount = Math.max(1, dayCount);
  const totalCapacityMin = validDayCount * dailyCapacityMin;
  const remainingDays = Math.max(1, validDayCount - Math.max(0, currentDayIndex));
  const remainingCapacityMin = remainingDays * dailyCapacityMin;

  const totalEstimateMin = steps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);
  const completedSteps = steps.filter((s) => s.status === 'done');
  const completedEstimateMin = completedSteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);

  const uncompletedSteps = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped');
  const remainingEstimateMin = uncompletedSteps.reduce((acc, s) => acc + (s.estimateMin || 0), 0);

  const completionRatePercent =
    totalEstimateMin > 0 ? Math.round((completedEstimateMin / totalEstimateMin) * 100) : 0;

  const overloadedDayIndices: number[] = [];
  for (let i = 0; i < validDayCount; i++) {
    const dayCap = calculateDayCapacity(steps, i, dailyCapacityMin);
    if (dayCap.isOverloaded) {
      overloadedDayIndices.push(i);
    }
  }

  // If all non-skipped steps are done
  if (steps.length > 0 && uncompletedSteps.length === 0) {
    return {
      health: 'Completed',
      totalEstimateMin,
      remainingEstimateMin,
      completedEstimateMin,
      remainingCapacityMin,
      totalCapacityMin,
      completionRatePercent: 100,
      overloadedDayIndices,
      recommendation: 'Mission complete! All planned milestones reached.',
    };
  }

  // Workload ratio relative to available capacity
  const ratio = remainingCapacityMin > 0 ? remainingEstimateMin / remainingCapacityMin : 1;

  let health: MissionHealth = 'On track';
  let recommendation = 'Schedule is balanced. On track for on-time delivery.';

  if (ratio > 1.15) {
    health = 'Behind';
    recommendation = `Remaining work (${Math.round(remainingEstimateMin / 60)}h) significantly exceeds remaining capacity (${Math.round(remainingCapacityMin / 60)}h). Consider rolling over or adjusting day count.`;
  } else if (ratio > 0.85 || overloadedDayIndices.includes(currentDayIndex)) {
    health = 'At risk';
    recommendation = `Remaining work is tight against capacity limit (${Math.round(ratio * 100)}% load). Little buffer for unexpected delays.`;
  }

  return {
    health,
    totalEstimateMin,
    remainingEstimateMin,
    completedEstimateMin,
    remainingCapacityMin,
    totalCapacityMin,
    completionRatePercent,
    overloadedDayIndices,
    recommendation,
  };
}

/**
 * Previews the effect of rolling over unfinished steps from past days into the target day or subsequent days.
 */
export function previewRollover({
  steps,
  currentDayIndex,
  targetDayIndex,
  dayCount,
  dailyCapacityMin = 240,
}: {
  steps: (StepSummary & { id: string })[];
  currentDayIndex: number;
  targetDayIndex: number;
  dayCount: number;
  dailyCapacityMin?: number;
}): {
  stepsToMove: { id: string; fromDay: number; toDay: number }[];
  currentHealth: MissionHealthResult;
  simulatedHealth: MissionHealthResult;
  targetDayCapacityBefore: DayCapacity;
  targetDayCapacityAfter: DayCapacity;
} {
  const currentHealth = calculateMissionHealth({
    steps,
    dayCount,
    currentDayIndex,
    dailyCapacityMin,
  });

  // Steps before target day that are not done or skipped
  const pastUnfinished = steps.filter(
    (s) => s.dayIndex < targetDayIndex && s.status !== 'done' && s.status !== 'skipped'
  );

  const stepsToMove = pastUnfinished.map((s) => ({
    id: s.id,
    fromDay: s.dayIndex,
    toDay: targetDayIndex,
  }));

  // Simulate new step distribution
  const simulatedSteps = steps.map((s) => {
    if (stepsToMove.some((m) => m.id === s.id)) {
      return { ...s, dayIndex: targetDayIndex };
    }
    return s;
  });

  const simulatedHealth = calculateMissionHealth({
    steps: simulatedSteps,
    dayCount,
    currentDayIndex,
    dailyCapacityMin,
  });

  const targetDayCapacityBefore = calculateDayCapacity(steps, targetDayIndex, dailyCapacityMin);
  const targetDayCapacityAfter = calculateDayCapacity(
    simulatedSteps,
    targetDayIndex,
    dailyCapacityMin
  );

  return {
    stepsToMove,
    currentHealth,
    simulatedHealth,
    targetDayCapacityBefore,
    targetDayCapacityAfter,
  };
}
