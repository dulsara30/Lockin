import { GoogleGenAI, Type, Schema } from '@google/genai';
import { env } from '@/lib/env';
import { getDecryptedGeminiKey } from '@/server/dal/settings';
import { checkAndIncrementAiUsage } from '@/server/dal/aiUsage';
import { ParsedPlan, planSchema } from '@/lib/templates/parser';

export interface PlanGenerationInput {
  userId: string;
  prompt: string;
  days: number;
  hoursPerDay: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface ReplanInput {
  userId: string;
  missionTitle: string;
  remainingDays: number;
  hoursPerDay: number;
  steps: Array<{
    title: string;
    estimateMin: number;
    priority: 'low' | 'medium' | 'high';
    notes?: string;
    checklist?: Array<{ text: string; done: boolean }>;
  }>;
}

export interface DailyBriefInput {
  userId: string;
  totalSteps: number;
  completedSteps: number;
  overdueSteps: number;
  nextStepTitle?: string;
}

/**
 * Resolves user's custom BYOK Gemini key or falls back to system shared key
 */
export async function resolveGeminiKey(
  userId: string
): Promise<{ apiKey: string; isCustom: boolean }> {
  const customKey = await getDecryptedGeminiKey(userId);
  if (customKey && customKey.trim().length > 0) {
    return { apiKey: customKey.trim(), isCustom: true };
  }
  return { apiKey: env.GEMINI_API_KEY, isCustom: false };
}

const planResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Clear, concise mission title' },
    description: { type: Type.STRING, description: 'One-line mission strategy summary' },
    dayCount: { type: Type.INTEGER, description: 'Total number of days' },
    hoursPerDay: { type: Type.INTEGER, description: 'Target work hours per day' },
    priority: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high'],
      description: 'Overall mission priority',
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Relevant categorical tags',
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayIndex: {
            type: Type.INTEGER,
            description: '0-based index of the day (0 to dayCount - 1)',
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Actionable verb-first step title' },
                estimateMin: {
                  type: Type.INTEGER,
                  description: 'Estimated minutes for step, <= 60 mins',
                },
                priority: {
                  type: Type.STRING,
                  enum: ['low', 'medium', 'high'],
                },
                notes: { type: Type.STRING, description: 'Short context or objective' },
                checklist: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: 'Subtask item' },
                      done: { type: Type.BOOLEAN, description: 'Subtask initial state' },
                    },
                    required: ['text', 'done'],
                  },
                },
              },
              required: ['title', 'estimateMin', 'priority'],
            },
          },
        },
        required: ['dayIndex', 'steps'],
      },
    },
  },
  required: ['title', 'dayCount', 'hoursPerDay', 'priority', 'days'],
};

/**
 * Generate a complete mission pipeline plan using Gemini
 */
export async function generatePlanWithGemini(input: PlanGenerationInput): Promise<ParsedPlan> {
  const { apiKey, isCustom } = await resolveGeminiKey(input.userId);

  // Check rate limits & daily caps
  const usageResult = await checkAndIncrementAiUsage(input.userId, isCustom);
  if (!usageResult.allowed) {
    const error = new Error(
      `Daily AI limit reached (${usageResult.calls}/${usageResult.limit} calls). ` +
        (isCustom
          ? 'You have reached your custom key cap for today.'
          : 'Add your own free Gemini API key in Settings for 100 calls/day, or import a template directly.')
    );
    (error as unknown as { code: string }).code = 'AI_LIMIT_REACHED';
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = env.GEMINI_MODEL;
  const targetCapacityMin = input.hoursPerDay * 60;

  const systemInstruction = `You are Lockin's elite planning intelligence.
Turn messy brain dumps and objectives into an actionable multi-day execution runway.

CRITICAL RULES:
1. Workload realism: The sum of step estimates on any single day MUST NOT exceed ${targetCapacityMin} minutes (${input.hoursPerDay} hours).
2. Granularity: Break large efforts into discrete, focused steps of 15 to 60 minutes each. NEVER exceed 60 minutes for a single step.
3. Front-load difficulty: Put the hardest, highest-friction, foundational steps on Days 1 and 2 when user energy is highest.
4. Subtasks: For every step with an estimate > 30 minutes, provide 2 to 4 actionable checklist subtasks.
5. Exact day indexing: Ensure exactly ${input.days} days are returned, with dayIndex from 0 to ${input.days - 1}.
6. Output: Strictly valid JSON conforming to the schema. No markdown backticks, no explanatory commentary outside JSON.`;

  const userPrompt = `GOAL / BRAIN DUMP:
"${input.prompt}"

PARAMETERS:
- Total Days: ${input.days}
- Daily Work Capacity: ${input.hoursPerDay} hours/day (${targetCapacityMin} minutes/day)
- Priority: ${input.priority || 'medium'}

Construct the complete execution pipeline.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: planResponseSchema,
        temperature: 0.3,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Empty response received from Gemini model.');
    }

    const parsedJson = JSON.parse(text);
    return planSchema.parse(parsedJson);
  } catch (error: unknown) {
    console.error('Gemini plan generation error:', error);
    const err = error as { code?: string; message?: string; status?: number };
    if (err.code === 'AI_LIMIT_REACHED') throw error;
    const msg = err.message ?? '';
    if (
      err.status === 404 ||
      msg.includes('no longer available') ||
      msg.includes('NOT_FOUND') ||
      msg.includes('404')
    ) {
      throw new Error(
        'The AI model is unavailable or deprecated. Please update GEMINI_MODEL in your environment or use the Template Import path instead.'
      );
    }
    throw new Error(
      'AI plan generation failed. Please try again or use the Template Import path instead.'
    );
  }
}

/**
 * Re-distribute remaining steps across remaining days (AI or fallback)
 */
export async function replanMissionWithGemini(input: ReplanInput): Promise<ParsedPlan> {
  const { apiKey, isCustom } = await resolveGeminiKey(input.userId);

  const usageResult = await checkAndIncrementAiUsage(input.userId, isCustom);
  if (!usageResult.allowed) {
    // Graceful offline fallback: algorithmic distribution
    return fallbackReplan(input);
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = env.GEMINI_MODEL;
  const targetCapacityMin = input.hoursPerDay * 60;

  const systemInstruction = `You are Lockin's re-planning engine.
The user is behind schedule on mission "${input.missionTitle}".
Redistribute their remaining unfinished tasks across ${input.remainingDays} remaining days.
Respect daily capacity (${input.hoursPerDay}h / ${targetCapacityMin}m per day). Keep steps <= 60 mins.`;

  const prompt = `Remaining steps to redistribute:
${JSON.stringify(input.steps, null, 2)}

Distribute across ${input.remainingDays} days (dayIndex 0 to ${input.remainingDays - 1}).`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: planResponseSchema,
        temperature: 0.2,
      },
    });

    const text = response.text?.trim();
    if (!text) return fallbackReplan(input);

    return planSchema.parse(JSON.parse(text));
  } catch (err) {
    console.warn('Replan Gemini call failed, using deterministic fallback:', err);
    return fallbackReplan(input);
  }
}

/**
 * Algorithmic fallback for replanning without AI cost
 */
function fallbackReplan(input: ReplanInput): ParsedPlan {
  const dayCount = Math.max(1, input.remainingDays);
  const capacityPerDayMin = input.hoursPerDay * 60;
  const days = Array.from({ length: dayCount }, (_, i) => ({
    dayIndex: i,
    steps: [] as ParsedPlan['days'][0]['steps'],
  }));
  const loads = new Array(dayCount).fill(0);

  for (const step of input.steps) {
    let placed = -1;
    for (let d = 0; d < dayCount; d++) {
      if (loads[d] + step.estimateMin <= capacityPerDayMin) {
        placed = d;
        break;
      }
    }
    if (placed === -1) {
      // Find min load
      let minIdx = 0;
      for (let d = 1; d < dayCount; d++) {
        if (loads[d] < loads[minIdx]) minIdx = d;
      }
      placed = minIdx;
    }
    days[placed].steps.push(step);
    loads[placed] += step.estimateMin;
  }

  return {
    title: input.missionTitle,
    dayCount,
    hoursPerDay: input.hoursPerDay,
    priority: 'high',
    tags: ['replanned'],
    days,
  };
}

/**
 * Generates an optional snappy 2-sentence morning brief for Today view
 */
export async function generateDailyBriefWithGemini(input: DailyBriefInput): Promise<string> {
  const { apiKey, isCustom } = await resolveGeminiKey(input.userId);

  const usageResult = await checkAndIncrementAiUsage(input.userId, isCustom);
  if (!usageResult.allowed) {
    return `You have ${input.totalSteps} tasks scheduled today. Focus on "${input.nextStepTitle || 'your next task'}" and lock in!`;
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = env.GEMINI_MODEL;

  const prompt = `User's day overview:
- Total tasks: ${input.totalSteps}
- Completed so far: ${input.completedSteps}
- Overdue from previous days: ${input.overdueSteps}
- Next up: ${input.nextStepTitle || 'None'}

Write an energetic, direct, 2-sentence briefing for a high-performer. No hashtags, no cheesy clichÃ©s. Linear/Things vibe.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return (
      response.text?.trim() ||
      `You have ${input.totalSteps} tasks scheduled today. Lock in on "${input.nextStepTitle || 'your next priority'}" and build momentum.`
    );
  } catch (error) {
    console.warn('Daily brief generation error:', error);
    return `You have ${input.totalSteps} tasks scheduled today. Focus on "${input.nextStepTitle || 'your next task'}" and crush it.`;
  }
}
