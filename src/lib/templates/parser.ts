import { z } from 'zod';

export interface ParsedSubtask {
  text: string;
  done: boolean;
}

export interface ParsedStep {
  title: string;
  estimateMin: number;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  checklist?: ParsedSubtask[];
}

export interface ParsedDay {
  dayIndex: number;
  steps: ParsedStep[];
}

export interface ParsedPlan {
  title: string;
  description?: string;
  dayCount: number;
  hoursPerDay: number;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  days: ParsedDay[];
}

export const planStepSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  estimateMin: z.number().int().positive().default(30),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().optional().default(''),
  checklist: z
    .array(
      z.object({
        text: z.string().min(1),
        done: z.boolean().default(false),
      })
    )
    .optional()
    .default([]),
});

export const planDaySchema = z.object({
  dayIndex: z.number().int().min(0),
  steps: z.array(planStepSchema),
});

export const planSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  dayCount: z.number().int().min(1).max(30).default(5),
  hoursPerDay: z.number().int().min(1).max(24).default(4),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).default([]),
  days: z.array(planDaySchema),
});

/**
 * Parses minutes from string like "45m", "1h", "90", "1.5h"
 */
export function parseEstimateMin(str?: string): number {
  if (!str) return 30;
  const clean = str.trim().toLowerCase();
  if (clean.endsWith('h')) {
    const hours = parseFloat(clean.replace('h', ''));
    return Math.max(5, Math.round((isNaN(hours) ? 1 : hours) * 60));
  }
  if (clean.endsWith('m')) {
    const mins = parseInt(clean.replace('m', ''), 10);
    return Math.max(5, isNaN(mins) ? 30 : mins);
  }
  const direct = parseInt(clean, 10);
  return Math.max(5, isNaN(direct) ? 30 : direct);
}

/**
 * Parses Markdown formatted mission template
 */
export function parseMarkdownTemplate(markdown: string): ParsedPlan {
  const lines = markdown.split(/\r?\n/);

  let title = 'New Mission';
  let description = '';
  let dayCount = 5;
  let hoursPerDay = 4;
  let priority: 'low' | 'medium' | 'high' = 'medium';
  let tags: string[] = [];

  const daysMap = new Map<number, ParsedStep[]>();
  let currentDayIndex = 0;
  let currentStep: ParsedStep | null = null;
  let inHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Mission Title: # Mission: <title> or # <title>
    if (line.startsWith('# ')) {
      const match = line.replace(/^#\s+(Mission:\s*)?/, '').trim();
      if (match) title = match;
      inHeader = true;
      continue;
    }

    // Day Header: ## Day N or ### Day N
    const dayMatch = line.match(/^#{2,3}\s+Day\s+(\d+)/i);
    if (dayMatch) {
      inHeader = false;
      currentDayIndex = parseInt(dayMatch[1], 10) - 1; // 0-indexed internally
      if (currentDayIndex < 0) currentDayIndex = 0;
      if (!daysMap.has(currentDayIndex)) {
        daysMap.set(currentDayIndex, []);
      }
      currentStep = null;
      continue;
    }

    // Subtask: indented bullet (e.g., "  - [ ] subtask" or "    * subtask")
    if (currentStep && /^\s{2,}[-*]\s+(\[[ xX]\]\s*)?/.test(line)) {
      const subtaskText = line.replace(/^\s+[-*]\s+(\[[ xX]\]\s*)?/, '').trim();
      const isDone = /\[[xX]\]/.test(line);
      if (subtaskText) {
        if (!currentStep.checklist) currentStep.checklist = [];
        currentStep.checklist.push({ text: subtaskText, done: isDone });
      }
      continue;
    }

    // Header metadata key: value
    if (inHeader) {
      const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].toLowerCase();
        const value = kvMatch[2].trim();

        if (key === 'days' || key === 'daycount') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0) dayCount = parsed;
        } else if (key === 'hoursperday' || key === 'hours') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0) hoursPerDay = parsed;
        } else if (key === 'priority') {
          const val = value.toLowerCase();
          if (val === 'high' || val === 'medium' || val === 'low') priority = val;
        } else if (key === 'tags') {
          tags = value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (key === 'description') {
          description = value;
        }
        continue;
      }
    }

    // Step line: - [ ] Step title | 45m | high | optional note
    const stepMatch = line.match(/^[-*]\s+(\[[ xX]\]\s*)?(.*)$/);
    if (stepMatch) {
      const rawContent = stepMatch[2].trim();
      const parts = rawContent.split('|').map((p) => p.trim());

      const stepTitle = parts[0] || 'Untitled Step';
      const estimateStr = parts[1];
      const prioStr = parts[2]?.toLowerCase();
      const noteStr = parts[3];

      let stepPrio: 'low' | 'medium' | 'high' = 'medium';
      if (prioStr === 'high' || prioStr === 'low' || prioStr === 'medium') {
        stepPrio = prioStr;
      }

      currentStep = {
        title: stepTitle,
        estimateMin: parseEstimateMin(estimateStr),
        priority: stepPrio,
        notes: noteStr || '',
        checklist: [],
      };

      if (!daysMap.has(currentDayIndex)) {
        daysMap.set(currentDayIndex, []);
      }
      daysMap.get(currentDayIndex)!.push(currentStep);
    }
  }

  // Calculate actual dayCount based on maximum day referenced
  const maxDayIndex = Math.max(...Array.from(daysMap.keys()), dayCount - 1);
  const totalDays = Math.max(maxDayIndex + 1, dayCount);

  const days: ParsedDay[] = [];
  for (let d = 0; d < totalDays; d++) {
    days.push({
      dayIndex: d,
      steps: daysMap.get(d) || [],
    });
  }

  return {
    title,
    description,
    dayCount: totalDays,
    hoursPerDay,
    priority,
    tags,
    days,
  };
}

/**
 * Parses plain checklist or unformatted task list and automatically
 * distributes steps across N days without exceeding daily capacity.
 */
export function parseChecklistToPlan(
  rawText: string,
  options: {
    title?: string;
    dayCount?: number;
    hoursPerDay?: number;
    priority?: 'low' | 'medium' | 'high';
  } = {}
): ParsedPlan {
  const lines = rawText.split(/\r?\n/);
  const steps: ParsedStep[] = [];
  let currentStep: ParsedStep | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if indented subtask
    if (currentStep && /^\s{2,}[-*]\s+(\[[ xX]\]\s*)?/.test(line)) {
      const subtaskText = line.replace(/^\s+[-*]\s+(\[[ xX]\]\s*)?/, '').trim();
      if (subtaskText) {
        if (!currentStep.checklist) currentStep.checklist = [];
        currentStep.checklist.push({ text: subtaskText, done: false });
      }
      continue;
    }

    // Step item (bulleted, numbered, or plain line)
    const cleanLine = trimmed
      .replace(/^[-*]\s+(\[[ xX]\]\s*)?/, '')
      .replace(/^\d+[\.)]\s+/, '')
      .trim();

    // Check for inline pipe delimiter "| 45m"
    const parts = cleanLine.split('|').map((p) => p.trim());
    const title = parts[0];
    const estimate = parseEstimateMin(parts[1]);
    const prio = (parts[2]?.toLowerCase() as 'low' | 'medium' | 'high') || 'medium';

    currentStep = {
      title,
      estimateMin: estimate,
      priority: ['low', 'medium', 'high'].includes(prio) ? prio : 'medium',
      checklist: [],
      notes: parts[3] || '',
    };
    steps.push(currentStep);
  }

  const dayCount = Math.max(1, options.dayCount || 5);
  const hoursPerDay = Math.max(1, options.hoursPerDay || 4);
  const capacityPerDayMin = hoursPerDay * 60;

  // Distribute steps across days greedily by capacity
  const days: ParsedDay[] = Array.from({ length: dayCount }, (_, i) => ({
    dayIndex: i,
    steps: [],
  }));

  const dayLoads = new Array(dayCount).fill(0);

  for (const step of steps) {
    // Find the earliest day that can hold this step without exceeding capacity
    let placedDay = -1;
    for (let d = 0; d < dayCount; d++) {
      if (dayLoads[d] + step.estimateMin <= capacityPerDayMin) {
        placedDay = d;
        break;
      }
    }

    // If all days are loaded to capacity, place in the least-loaded day
    if (placedDay === -1) {
      let minLoadIndex = 0;
      for (let d = 1; d < dayCount; d++) {
        if (dayLoads[d] < dayLoads[minLoadIndex]) {
          minLoadIndex = d;
        }
      }
      placedDay = minLoadIndex;
    }

    days[placedDay].steps.push(step);
    dayLoads[placedDay] += step.estimateMin;
  }

  return {
    title: options.title || 'Imported Checklist Mission',
    description: `Auto-distributed from ${steps.length} checklist items.`,
    dayCount,
    hoursPerDay,
    priority: options.priority || 'medium',
    tags: ['imported'],
    days,
  };
}

/**
 * Validates JSON structure against planSchema
 */
export function parseJsonTemplate(jsonString: string): ParsedPlan {
  const parsed = JSON.parse(jsonString);
  return planSchema.parse(parsed);
}

/**
 * Generates sample markdown template file content
 */
export function generateSampleMarkdownTemplate(): string {
  return `# Mission: Build MVP Launch Pipeline
days: 5
hoursPerDay: 4
priority: high
tags: launch, product, sprint
description: High-velocity 5-day sprint to ship MVP feature set.

## Day 1
- [ ] Define user flows and wireframes | 60m | high | Map core journeys
  - [ ] Sketch auth flow
  - [ ] Review checkout steps
- [ ] Database schema migrations | 90m | high | Mongoose models & indexes
- [ ] Setup API endpoints | 45m | medium | Route handlers with Zod

## Day 2
- [ ] Build core UI dashboard | 90m | high | Reusable components and layout
- [ ] Connect state and TanStack Query | 60m | high | Optimistic updates
- [ ] Form validations and error states | 45m | medium | Accessible field alerts

## Day 3
- [ ] Payment gateway integration | 120m | high | Webhooks and checkout
  - [ ] Test mode keys
  - [ ] Verify idempotency
- [ ] Transaction email triggers | 45m | medium | Welcome & receipt

## Day 4
- [ ] End-to-end integration testing | 90m | high | Vitest & user scenarios
- [ ] Performance profiling & bundle audit | 45m | medium | Lazy imports
- [ ] Mobile responsive tuning | 60m | medium | Viewport checks

## Day 5
- [ ] Production deployment & DNS | 60m | high | Vercel setup
- [ ] Smoke test staging and live | 45m | high | Health check routes
- [ ] Launch announcement & socials | 30m | low | Share link with beta users
`;
}

/**
 * Generates sample JSON template file content
 */
export function generateSampleJsonTemplate(): string {
  const sample = {
    title: 'Build MVP Launch Pipeline',
    description: 'High-velocity 5-day sprint to ship MVP feature set.',
    dayCount: 5,
    hoursPerDay: 4,
    priority: 'high',
    tags: ['launch', 'product', 'sprint'],
    days: [
      {
        dayIndex: 0,
        steps: [
          {
            title: 'Define user flows and wireframes',
            estimateMin: 60,
            priority: 'high',
            notes: 'Map core journeys',
            checklist: [{ text: 'Sketch auth flow', done: false }],
          },
          {
            title: 'Database schema migrations',
            estimateMin: 90,
            priority: 'high',
            notes: '',
            checklist: [],
          },
        ],
      },
      {
        dayIndex: 1,
        steps: [
          {
            title: 'Build core UI dashboard',
            estimateMin: 90,
            priority: 'high',
            notes: '',
            checklist: [],
          },
        ],
      },
    ],
  };

  return JSON.stringify(sample, null, 2);
}
