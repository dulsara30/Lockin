import { z } from 'zod';
import { generateKeyBetween } from 'fractional-indexing';
import { ToolDef, ToolError } from '@/lib/mcp/protocol';
import { calculateMissionHealth } from '@/lib/planning';
import { checkRateLimit } from '@/lib/ratelimit';
import { EXPORT_FORMATS, renderExport } from '@/lib/export/runway-export';
import {
  parseChecklistToPlan,
  parseJsonTemplate,
  parseMarkdownTemplate,
  planSchema,
  ParsedPlan,
} from '@/lib/templates/parser';
import { generatePlanWithGemini, replanMissionWithGemini } from '@/lib/ai/gemini';
import {
  createMission,
  getMissionById,
  getMissions,
  updateMission,
  archiveMission,
} from '@/server/dal/missions';
import {
  createRunway,
  deleteRunway,
  getRunwayById,
  getRunwayByMission,
  getRunwaysByMission,
  startDay,
  syncMissionToRunway,
  updateRunway,
  switchActiveRunway,
} from '@/server/dal/runways';
import {
  createStep,
  deleteStep,
  getAllSteps,
  getStepById,
  getStepsByMission,
  getStepsByRunway,
  reorderStep,
  rolloverSteps,
  updateStep,
} from '@/server/dal/steps';
import { getTodayDashboardData } from '@/server/dal/today';
import { getInsightsData } from '@/server/dal/insights';
import { getTemplateById, getTemplates, saveMissionAsTemplate } from '@/server/dal/templates';
import { getUserSettings } from '@/server/dal/settings';
import { checkAiUsage } from '@/server/dal/aiUsage';
import { startTimeLog, stopTimeLog } from '@/server/dal/timeLogs';
import {
  addMember,
  listMembers,
  removeMember,
  updateMemberRole,
  getSharedMissions,
  getMemberCounts,
} from '@/server/dal/members';
import { getUserProfile } from '@/server/dal/mcp';
import { requireMissionAccess, requireRunwayAccess, requireStepAccess } from '@/server/dal/access';
import { loadExportDoc } from '@/server/export/runway-doc';
import { dayDate, dayIndexForDate } from '@/lib/dates';
import { normalizeNotes } from '@/lib/notes';

/**
 * MCP tool catalog. Every tool acts as the single configured user and goes through the
 * same access layer as the web app (owner / editor / viewer), so MCP can never do more
 * than that user can do in the UI.
 *
 * Deliberately NOT exposed (hard deny): deleting missions or users, account / session /
 * credential changes, API-key (BYOK) management, whole-account data export, and any raw
 * database access or schema change.
 */

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'must be a 24-character hex id');
const dayIndex = z.number().int().min(0).max(29);
const priority = z.enum(['low', 'medium', 'high']);
const status = z.enum(['todo', 'doing', 'done', 'blocked', 'skipped']);
const checklist = z
  .array(z.object({ text: z.string().trim().min(1).max(300), done: z.boolean().default(false) }))
  .max(50);

/** Strip internal ownership fields and normalize ObjectIds/Dates to JSON. */
function clean<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (k, v) =>
      k === 'userId' || k === '__v' || k === 'ownerId' ? undefined : v
    )
  );
}

const MS_DAY = 24 * 60 * 60 * 1000;

const notesField = z
  .string()
  .max(10_000)
  .describe(
    'Markdown notes. Use "- " for bullets, "1." for numbered lists, a blank line between paragraphs, **bold** and ## headings. Never use the "•" character (it is converted for you, but lists render best as real Markdown).'
  );

async function persistPlan(
  actorId: string,
  plan: ParsedPlan,
  opts: { missionId?: string; color?: string; runwayTitle?: string; replan?: boolean }
) {
  const startDate = new Date();
  const deadline = new Date(startDate.getTime() + plan.dayCount * MS_DAY);

  let ownerId = actorId;
  let missionId: string;
  if (opts.missionId) {
    const access = await requireMissionAccess(actorId, opts.missionId, 'editor');
    ownerId = access.ownerId;
    const existing = await getMissionById(ownerId, opts.missionId);
    if (!existing) throw new ToolError('Mission not found');
    missionId = opts.missionId;
  } else {
    const m = await createMission(actorId, {
      title: plan.title,
      description: plan.description || '',
      color: opts.color || '#7C5CFF',
      priority: plan.priority,
      tags: plan.tags,
      startDate,
      deadline,
      dayCount: plan.dayCount,
    });
    missionId = m._id.toString();
  }

  const versions = opts.replan ? await getRunwaysByMission(ownerId, missionId) : [];
  const nextVersion = versions.length ? Math.max(...versions.map((r) => r.version || 1)) + 1 : 1;
  const runway = await createRunway(ownerId, {
    missionId,
    title: opts.replan
      ? `${plan.title || 'Pipeline'} (v${nextVersion})`
      : opts.runwayTitle || `${plan.title} Runway`,
    description: plan.description || '',
    dayCount: plan.dayCount,
    startDate,
    deadline,
    hoursPerDay: plan.hoursPerDay,
    ...(opts.replan ? { version: nextVersion, isOriginal: false } : {}),
  });
  const runwayId = runway._id.toString();

  let stepCount = 0;
  for (const day of plan.days) {
    let prev: string | null = null;
    for (const s of day.steps) {
      const order = generateKeyBetween(prev, null);
      prev = order;
      await createStep(ownerId, {
        missionId,
        runwayId,
        dayIndex: day.dayIndex,
        order,
        title: s.title,
        notes: normalizeNotes(s.notes || ''),
        estimateMin: s.estimateMin,
        status: 'todo',
        checklist: (s.checklist || []).map((c) => ({ text: c.text, done: c.done })),
      });
      stepCount++;
    }
  }
  return { missionId, runwayId, stepCount };
}

const planInput = planSchema.describe(
  'Plan in Lockin format: {title, dayCount, hoursPerDay, priority, tags, days:[{dayIndex, steps:[{title, estimateMin, priority, notes, checklist}]}]}'
);

export const tools: ToolDef[] = [
  // ------------------------------------------------------------------ READ
  {
    name: 'whoami',
    title: 'Who am I',
    description: 'Returns the Lockin account this MCP server acts as.',
    tier: 'read',
    input: z.object({}),
    async run(_a, { userId }) {
      return clean(await getUserProfile(userId));
    },
  },
  {
    name: 'list_missions',
    title: 'List missions',
    description:
      'Lists missions you own and missions shared with you, with role and progress. Use scope to filter.',
    tier: 'read',
    input: z.object({
      scope: z.enum(['all', 'mine', 'shared']).default('all'),
      includeArchived: z.boolean().default(false),
    }),
    async run({ scope, includeArchived }, { userId }) {
      const out: unknown[] = [];
      if (scope !== 'shared') {
        const [missions, steps, counts] = await Promise.all([
          getMissions(userId, { includeArchived }),
          getAllSteps(userId),
          getMemberCounts(userId),
        ]);
        for (const m of missions) {
          const mid = m._id.toString();
          const ms = steps.filter((s) => s.missionId.toString() === mid);
          out.push({
            id: mid,
            title: m.title,
            description: m.description,
            priority: m.priority,
            status: m.status,
            archived: m.archived,
            deadline: m.deadline,
            dayCount: m.dayCount,
            role: 'owner',
            members: counts.get(mid) || 0,
            steps: ms.length,
            stepsDone: ms.filter((s) => s.status === 'done').length,
          });
        }
      }
      if (scope !== 'mine') {
        for (const s of await getSharedMissions(userId)) {
          const m = s.mission as Record<string, unknown> & { _id: { toString(): string } };
          out.push({
            id: m._id.toString(),
            title: m.title,
            description: m.description,
            priority: m.priority,
            status: m.status,
            deadline: m.deadline,
            dayCount: m.dayCount,
            role: s.role,
            sharedBy: s.ownerName,
            steps: s.stepCount,
            stepsDone: s.completedStepCount,
          });
        }
      }
      return out;
    },
  },
  {
    name: 'get_mission',
    title: 'Get mission',
    description: 'Mission details with runway versions, progress, health and members.',
    tier: 'read',
    input: z.object({ missionId: id }),
    async run({ missionId }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'viewer');
      const o = access.ownerId;
      const [mission, runways, active, members, settings] = await Promise.all([
        getMissionById(o, missionId),
        getRunwaysByMission(o, missionId),
        getRunwayByMission(o, missionId),
        listMembers(o, missionId),
        getUserSettings(userId),
      ]);
      if (!mission) throw new ToolError('Mission not found');
      const steps = active ? await getStepsByRunway(o, active._id.toString()) : [];
      const dayNow = active
        ? Math.max(
            0,
            Math.min(
              active.dayCount - 1,
              dayIndexForDate(active.startDate, new Date(), settings.timezone)
            )
          )
        : 0;
      // Capacity is what the runway was planned with, else the user's setting
      const hoursPerDay = active?.hoursPerDay || settings.workHoursPerDay || 4;
      const health = active
        ? calculateMissionHealth({
            steps: steps.map((s) => ({
              estimateMin: s.estimateMin,
              status: s.status,
              dayIndex: s.dayIndex,
            })),
            dayCount: active.dayCount,
            currentDayIndex: dayNow,
            dailyCapacityMin: hoursPerDay * 60,
          })
        : null;
      return {
        role: access.role,
        mission: clean(mission),
        runways: runways.map((r) => ({
          id: r._id.toString(),
          title: r.title,
          version: r.version,
          isActive: r.isActive,
          dayCount: r.dayCount,
        })),
        health,
        capacity: active
          ? {
              hoursPerDay,
              dayCount: active.dayCount,
              totalHours: hoursPerDay * active.dayCount,
              hoursPerDaySource: active.hoursPerDay
                ? 'runway'
                : 'user settings (set it with update_runway)',
              missionDayCountInSync: mission.dayCount === active.dayCount,
              today: {
                dayIndex: dayNow,
                date: dayDate(active.startDate, dayNow, settings.timezone),
              },
            }
          : null,
        members: members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
        })),
      };
    },
  },
  {
    name: 'get_runway',
    title: 'Get runway',
    description: 'All days with every step (ids, status, estimates, checklist) for a runway.',
    tier: 'read',
    input: z.object({ runwayId: id }),
    async run({ runwayId }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'viewer');
      const [runway, steps, settings] = await Promise.all([
        getRunwayById(access.ownerId, runwayId),
        getStepsByRunway(access.ownerId, runwayId),
        getUserSettings(userId),
      ]);
      if (!runway) throw new ToolError('Runway not found');
      return {
        runway: clean(runway),
        timezone: settings.timezone,
        days: Array.from({ length: runway.dayCount }, (_, d) => ({
          dayIndex: d,
          date: dayDate(runway.startDate, d, settings.timezone),
          steps: clean(steps.filter((s) => s.dayIndex === d)),
        })),
      };
    },
  },
  {
    name: 'get_day',
    title: 'Get day',
    description: 'Date and steps of a single day (0-based dayIndex) in a runway.',
    tier: 'read',
    input: z.object({ runwayId: id, dayIndex }),
    async run({ runwayId, dayIndex: d }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'viewer');
      const [runway, steps, settings] = await Promise.all([
        getRunwayById(access.ownerId, runwayId),
        getStepsByRunway(access.ownerId, runwayId),
        getUserSettings(userId),
      ]);
      if (!runway) throw new ToolError('Runway not found');
      if (d >= runway.dayCount) throw new ToolError('Day not found');
      return {
        dayIndex: d,
        date: dayDate(runway.startDate, d, settings.timezone),
        timezone: settings.timezone,
        steps: clean(steps.filter((s) => s.dayIndex === d)),
      };
    },
  },
  {
    name: 'get_step',
    title: 'Get step',
    description: 'Full details of one step.',
    tier: 'read',
    input: z.object({ stepId: id }),
    async run({ stepId }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'viewer');
      return clean(await getStepById(access.ownerId, stepId));
    },
  },
  {
    name: 'get_today',
    title: 'Get today',
    description: "Today's steps across your active missions, next-up step and streak.",
    tier: 'read',
    input: z.object({}),
    async run(_a, { userId }) {
      return clean(await getTodayDashboardData(userId));
    },
  },
  {
    name: 'get_insights',
    title: 'Get insights',
    description: 'Completion rate, streaks, planned vs actual hours and drag alerts.',
    tier: 'read',
    input: z.object({ missionId: id.optional() }),
    async run({ missionId }, { userId }) {
      let owner = userId;
      if (missionId) owner = (await requireMissionAccess(userId, missionId, 'viewer')).ownerId;
      return clean(await getInsightsData(owner, missionId));
    },
  },
  {
    name: 'list_members',
    title: 'List members',
    description: 'Who has access to a mission and with which role.',
    tier: 'read',
    input: z.object({ missionId: id }),
    async run({ missionId }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'viewer');
      return await listMembers(access.ownerId, missionId);
    },
  },
  {
    name: 'list_templates',
    title: 'List templates',
    description: 'Saved mission templates.',
    tier: 'read',
    input: z.object({}),
    async run(_a, { userId }) {
      const templates = await getTemplates(userId);
      return templates.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        description: t.description,
        dayCount: t.structure?.dayCount,
      }));
    },
  },
  {
    name: 'get_settings',
    title: 'Get settings',
    description: 'Planning settings (work hours, capacity, timezone). Never returns API keys.',
    tier: 'read',
    input: z.object({}),
    async run(_a, { userId }) {
      return await getUserSettings(userId);
    },
  },
  {
    name: 'get_ai_usage',
    title: 'Get AI usage',
    description: "Today's AI call usage and remaining quota.",
    tier: 'read',
    input: z.object({}),
    async run(_a, { userId }) {
      const settings = await getUserSettings(userId);
      return await checkAiUsage(userId, settings.hasCustomGeminiKey);
    },
  },
  {
    name: 'export_runway',
    title: 'Export runway',
    description:
      'Exports a whole runway, or one day, as json, md, csv, xlsx or pdf (xlsx/pdf are base64).',
    tier: 'read',
    input: z.object({
      runwayId: id,
      format: z.enum(EXPORT_FORMATS),
      dayIndex: dayIndex.optional(),
    }),
    async run({ runwayId, format, dayIndex: d }, { userId }) {
      return renderExport(await loadExportDoc(userId, runwayId, d), format);
    },
  },
  {
    name: 'parse_template',
    title: 'Parse template',
    description:
      'Parses a Markdown / JSON template or a plain checklist into a plan WITHOUT saving it (no AI, no cost).',
    tier: 'read',
    input: z.object({
      content: z.string().min(5).max(100_000),
      format: z.enum(['markdown', 'json', 'checklist']),
      days: z.number().int().min(1).max(30).optional(),
      hoursPerDay: z.number().int().min(1).max(16).optional(),
    }),
    async run({ content, format, days, hoursPerDay }) {
      try {
        if (format === 'markdown') return parseMarkdownTemplate(content);
        if (format === 'json') return parseJsonTemplate(content);
        return parseChecklistToPlan(content, { dayCount: days, hoursPerDay });
      } catch (e) {
        throw new ToolError(
          `Could not parse template: ${e instanceof Error ? e.message : 'invalid'}`
        );
      }
    },
  },
  {
    name: 'generate_plan',
    title: 'Generate plan with AI',
    description:
      'Turns a brain dump into a day-by-day plan using Gemini. Returns a preview only; call save_plan to persist. Uses your daily AI quota.',
    tier: 'read',
    openWorld: true,
    input: z.object({
      prompt: z.string().min(5).max(5000),
      days: z.number().int().min(1).max(30).default(5),
      hoursPerDay: z.number().int().min(1).max(16).default(4),
      priority: priority.default('medium'),
    }),
    async run(args, { userId }) {
      try {
        return await generatePlanWithGemini({ userId, ...args });
      } catch (e) {
        throw new ToolError(e instanceof Error ? e.message : 'AI plan generation failed');
      }
    },
  },
  {
    name: 'replan_preview',
    title: 'Re-plan preview (AI)',
    description:
      'Re-balances the unfinished steps of a mission across remaining days and checks feasibility. Preview only; call apply_replan to save. May use AI quota (falls back offline).',
    tier: 'read',
    openWorld: true,
    input: z.object({ missionId: id, hoursPerDay: z.number().int().min(1).max(16).default(4) }),
    async run({ missionId, hoursPerDay }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'editor');
      const o = access.ownerId;
      const [steps, mission, runway] = await Promise.all([
        getStepsByMission(o, missionId),
        getMissionById(o, missionId),
        getRunwayByMission(o, missionId),
      ]);
      const open = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped');
      if (open.length === 0) throw new ToolError('No incomplete steps to re-plan.');

      const deadline = runway?.deadline || mission?.deadline || new Date(Date.now() + 7 * MS_DAY);
      const daysLeft = Math.max(1, Math.ceil((new Date(deadline).getTime() - Date.now()) / MS_DAY));
      const totalMin = open.reduce((a, s) => a + s.estimateMin, 0);
      const capacity = daysLeft * hoursPerDay * 60;
      const plan = await replanMissionWithGemini({
        userId,
        missionTitle: mission?.title ? `${mission.title} Re-plan` : 'Re-planned Pipeline',
        remainingDays: Math.max(2, Math.ceil(totalMin / (hoursPerDay * 60))),
        hoursPerDay,
        steps: open.map((s) => ({
          title: s.title,
          estimateMin: s.estimateMin,
          priority: 'medium' as const,
          notes: s.notes,
          checklist: s.checklist?.map((c) => ({ text: c.text, done: c.done })),
        })),
      });
      return {
        feasibility: {
          isFeasible: totalMin <= capacity,
          daysLeft,
          remainingMinutes: totalMin,
          availableMinutes: capacity,
          extraDaysNeeded: Math.ceil(Math.max(0, totalMin - capacity) / (hoursPerDay * 60)),
        },
        plan,
      };
    },
  },

  // ----------------------------------------------------------------- WRITE
  {
    name: 'create_mission',
    title: 'Create mission',
    description: 'Creates an empty mission (add a runway with create_runway or save_plan).',
    tier: 'write',
    input: z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).default(''),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      dayCount: z.number().int().min(1).max(30).default(5),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .default('#7C5CFF'),
      tags: z.array(z.string().trim().max(40)).max(20).default([]),
    }),
    async run(a, { userId }) {
      const startDate = new Date();
      const m = await createMission(userId, {
        ...a,
        startDate,
        deadline: new Date(startDate.getTime() + a.dayCount * MS_DAY),
      });
      return clean(m);
    },
  },
  {
    name: 'update_mission',
    title: 'Update mission',
    description:
      'Edits mission fields, timeline (dayCount, startDate) or marks it active/completed. startDate also moves the active runway calendar. Archiving is a separate critical tool.',
    tier: 'write',
    input: z.object({
      missionId: id,
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(2000).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      tags: z.array(z.string().trim().max(40)).max(20).optional(),
      deadline: z.string().datetime().optional().describe('ISO 8601 date-time'),
      dayCount: z.number().int().min(1).max(30).optional(),
      startDate: z.string().datetime().optional().describe('ISO 8601 date-time'),
      status: z.enum(['active', 'completed']).optional(),
    }),
    async run({ missionId, deadline, startDate, ...changes }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'editor');
      const o = access.ownerId;
      const start = startDate ? new Date(startDate) : undefined;
      const updated = await updateMission(o, missionId, {
        ...changes,
        ...(deadline ? { deadline: new Date(deadline) } : {}),
        ...(start ? { startDate: start } : {}),
      });
      if (!updated) throw new ToolError('Mission not found');

      // Keep the active runway calendar aligned when the start moves
      const active = await getRunwayByMission(o, missionId);
      if (active && start) {
        await updateRunway(o, active._id.toString(), {
          startDate: start,
          deadline: new Date(start.getTime() + active.dayCount * MS_DAY),
        });
      }
      return {
        mission: clean(updated),
        activeRunway: active
          ? {
              id: active._id.toString(),
              dayCount: active.dayCount,
              inSync: active.dayCount === updated.dayCount,
            }
          : null,
      };
    },
  },
  {
    name: 'create_runway',
    title: 'Create runway',
    description: 'Creates an empty runway (new version) under a mission.',
    tier: 'write',
    input: z.object({
      missionId: id,
      title: z.string().trim().min(1).max(120),
      dayCount: z.number().int().min(1).max(30).default(5),
    }),
    async run({ missionId, title, dayCount }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'editor');
      const startDate = new Date();
      return clean(
        await createRunway(access.ownerId, {
          missionId,
          title,
          dayCount,
          startDate,
          deadline: new Date(startDate.getTime() + dayCount * MS_DAY),
        })
      );
    },
  },
  {
    name: 'update_runway',
    title: 'Update runway',
    description:
      'Edits a runway: title and hoursPerDay (the daily capacity used for health). Also re-aligns the mission dayCount and deadline to the active runway.',
    tier: 'write',
    input: z.object({
      runwayId: id,
      title: z.string().trim().min(1).max(120).optional(),
      hoursPerDay: z.number().int().min(1).max(24).optional(),
    }),
    async run({ runwayId, ...changes }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'editor');
      const updated = await updateRunway(access.ownerId, runwayId, changes);
      if (!updated) throw new ToolError('Runway not found');
      const synced = await syncMissionToRunway(access.ownerId, access.missionId);
      return {
        runway: clean(updated),
        missionTimeline: synced ? { dayCount: synced.dayCount, deadline: synced.deadline } : null,
      };
    },
  },
  {
    name: 'create_step',
    title: 'Create step',
    description: 'Adds a step to a day (0-based) of a mission, appended at the end of that day.',
    tier: 'write',
    input: z.object({
      missionId: id,
      runwayId: id.optional(),
      dayIndex,
      title: z.string().trim().min(1).max(200),
      notes: notesField.default(''),
      estimateMin: z.number().int().min(0).max(1440).default(30),
      checklist: checklist.default([]),
    }),
    async run(a, { userId }) {
      const access = await requireMissionAccess(userId, a.missionId, 'editor');
      if (a.runwayId) {
        const runway = await getRunwayById(access.ownerId, a.runwayId);
        if (!runway || runway.missionId.toString() !== a.missionId) {
          throw new ToolError('Runway not found');
        }
      }
      return clean(await createStep(access.ownerId, { ...a, notes: normalizeNotes(a.notes) }));
    },
  },
  {
    name: 'update_step',
    title: 'Update step',
    description:
      'Edits a step: title, notes, estimate, status (todo/doing/done/blocked/skipped), checklist.',
    tier: 'write',
    input: z.object({
      stepId: id,
      title: z.string().trim().min(1).max(200).optional(),
      notes: notesField.optional(),
      estimateMin: z.number().int().min(0).max(1440).optional(),
      actualMin: z.number().int().min(0).max(100_000).optional(),
      status: status.optional(),
      checklist: checklist.optional(),
    }),
    async run({ stepId, ...changes }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      const updated = await updateStep(access.ownerId, stepId, {
        ...changes,
        ...(changes.notes !== undefined ? { notes: normalizeNotes(changes.notes) } : {}),
      });
      if (!updated) throw new ToolError('Step not found');
      return clean(updated);
    },
  },
  {
    name: 'append_step_notes',
    title: 'Append to step notes',
    description:
      'Adds Markdown to the end of a step notes (keeps existing notes). Shown with rich formatting in the app: use real lists, bold and headings.',
    tier: 'write',
    input: z.object({ stepId: id, markdown: z.string().min(1).max(5000) }),
    async run({ stepId, markdown }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      const step = await getStepById(access.ownerId, stepId);
      if (!step) throw new ToolError('Step not found');
      const existing = step.notes ? `${step.notes.trimEnd()}\n\n` : '';
      const next = normalizeNotes(existing + markdown);
      if (next.length > 10_000) throw new ToolError('Notes would exceed 10,000 characters.');
      const updated = await updateStep(access.ownerId, stepId, { notes: next });
      return { success: true, notes: updated?.notes };
    },
  },
  {
    name: 'move_step',
    title: 'Move step',
    description: 'Moves a step to another day (0-based), at the start or end of that day.',
    tier: 'write',
    input: z.object({ stepId: id, dayIndex, position: z.enum(['start', 'end']).default('end') }),
    async run({ stepId, dayIndex: d, position }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      const o = access.ownerId;
      const step = await getStepById(o, stepId);
      if (!step) throw new ToolError('Step not found');
      const siblings = (
        step.runwayId
          ? await getStepsByRunway(o, step.runwayId.toString())
          : await getStepsByMission(o, access.stepMissionId)
      )
        .filter((s) => s.dayIndex === d && s._id.toString() !== stepId)
        .sort((a, b) => a.order.localeCompare(b.order));
      const order =
        position === 'start'
          ? generateKeyBetween(null, siblings[0]?.order ?? null)
          : generateKeyBetween(siblings[siblings.length - 1]?.order ?? null, null);
      return clean(await reorderStep(o, stepId, d, order));
    },
  },
  {
    name: 'rollover_steps',
    title: 'Roll over steps',
    description: 'Moves the given unfinished steps of a mission to another day.',
    tier: 'write',
    input: z.object({ missionId: id, stepIds: z.array(id).min(1).max(100), toDay: dayIndex }),
    async run({ missionId, stepIds, toDay }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'editor');
      return await rolloverSteps(
        access.ownerId,
        missionId,
        stepIds.map((i: string) => ({ id: i, toDay }))
      );
    },
  },
  {
    name: 'start_day',
    title: 'Start day clock',
    description: 'Starts the 24-hour commitment clock for a day of a runway.',
    tier: 'write',
    input: z.object({ runwayId: id, dayIndex }),
    async run({ runwayId, dayIndex: d }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'editor');
      const r = await startDay(access.ownerId, runwayId, d);
      if (!r) throw new ToolError('Runway not found');
      return { success: true };
    },
  },
  {
    name: 'switch_active_runway',
    title: 'Switch active runway',
    description: 'Makes another runway version the active one for a mission.',
    tier: 'write',
    input: z.object({ missionId: id, runwayId: id }),
    async run({ missionId, runwayId }, { userId }) {
      const access = await requireMissionAccess(userId, missionId, 'editor');
      const r = await getRunwayById(access.ownerId, runwayId);
      if (!r || r.missionId.toString() !== missionId) throw new ToolError('Runway not found');
      await switchActiveRunway(access.ownerId, missionId, runwayId);
      return { success: true };
    },
  },
  {
    name: 'log_time',
    title: 'Log time on a step',
    description: 'Records minutes worked on a step (adds to its actual time).',
    tier: 'write',
    input: z.object({ stepId: id, minutes: z.number().int().min(1).max(1440) }),
    async run({ stepId, minutes }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      const log = await startTimeLog(userId, stepId, access.stepMissionId);
      await stopTimeLog(userId, log._id.toString(), minutes * 60, access.ownerId);
      return { success: true, minutes };
    },
  },
  {
    name: 'save_plan',
    title: 'Save plan',
    description:
      'Persists a plan (from generate_plan, parse_template or hand-written) as a new mission + runway, or as a new runway under missionId.',
    tier: 'write',
    input: z.object({
      plan: planInput,
      missionId: id.optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      runwayTitle: z.string().trim().max(120).optional(),
    }),
    async run({ plan, ...opts }, { userId }) {
      return await persistPlan(userId, plan, opts);
    },
  },
  {
    name: 'apply_replan',
    title: 'Apply re-plan',
    description:
      'Saves a re-plan as a NEW runway version (the previous version is preserved and can be switched back to).',
    tier: 'write',
    input: z.object({ missionId: id, plan: planInput }),
    async run({ missionId, plan }, { userId }) {
      return await persistPlan(userId, plan, { missionId, replan: true });
    },
  },
  {
    name: 'deploy_template',
    title: 'Deploy template',
    description: 'Creates a new mission + runway from a saved template.',
    tier: 'write',
    input: z.object({ templateId: id }),
    async run({ templateId }, { userId }) {
      const t = await getTemplateById(userId, templateId);
      if (!t) throw new ToolError('Template not found');
      return await persistPlan(userId, planSchema.parse(t.structure), {});
    },
  },
  {
    name: 'save_mission_as_template',
    title: 'Save mission as template',
    description: 'Saves one of YOUR missions as a reusable template.',
    tier: 'write',
    input: z.object({ missionId: id, name: z.string().trim().min(1).max(120) }),
    async run({ missionId, name }, { userId }) {
      try {
        return clean(await saveMissionAsTemplate(userId, missionId, name));
      } catch {
        throw new ToolError('Mission not found');
      }
    },
  },

  // -------------------------------------------------------------- CRITICAL
  {
    name: 'delete_step',
    title: 'Delete step',
    description: 'Permanently deletes a step.',
    tier: 'critical',
    input: z.object({ stepId: id }),
    async preview({ stepId }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      const s = await getStepById(access.ownerId, stepId);
      return `Will permanently delete the step "${s?.title}" (Day ${(s?.dayIndex ?? 0) + 1}, ${s?.estimateMin}m, status ${s?.status}). This cannot be undone.`;
    },
    async run({ stepId }, { userId }) {
      const access = await requireStepAccess(userId, stepId, 'editor');
      await deleteStep(access.ownerId, stepId);
      return { success: true };
    },
  },
  {
    name: 'delete_runway',
    title: 'Delete runway',
    description: 'Permanently deletes a runway version and ALL of its steps.',
    tier: 'critical',
    input: z.object({ runwayId: id }),
    async preview({ runwayId }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'editor');
      const [r, steps] = await Promise.all([
        getRunwayById(access.ownerId, runwayId),
        getStepsByRunway(access.ownerId, runwayId),
      ]);
      return `Will permanently delete runway "${r?.title}" (v${r?.version}) and its ${steps.length} step(s). This cannot be undone.`;
    },
    async run({ runwayId }, { userId }) {
      const access = await requireRunwayAccess(userId, runwayId, 'editor');
      await deleteRunway(access.ownerId, runwayId);
      return { success: true };
    },
  },
  {
    name: 'archive_mission',
    title: 'Archive / restore mission',
    description: 'Archives a mission you own (or restores it with archived=false). Owner only.',
    tier: 'critical',
    input: z.object({ missionId: id, archived: z.boolean().default(true) }),
    async preview({ missionId, archived }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      const m = await getMissionById(userId, missionId);
      return `Will ${archived ? 'archive' : 'restore'} the mission "${m?.title}". Collaborators ${archived ? 'will no longer see it in lists' : 'will see it again'}.`;
    },
    async run({ missionId, archived }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      await archiveMission(userId, missionId, archived);
      return { success: true };
    },
  },
  {
    name: 'add_member',
    title: 'Share mission',
    description: 'Gives an existing Lockin user viewer or editor access to a mission you own.',
    tier: 'critical',
    input: z.object({
      missionId: id,
      email: z.string().trim().max(254).email(),
      role: z.enum(['viewer', 'editor']),
    }),
    async preview({ missionId, email, role }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      const m = await getMissionById(userId, missionId);
      return `Will share "${m?.title}" with ${email.toLowerCase()} as ${role === 'editor' ? 'EDITOR (can change everything except sharing/deleting)' : 'viewer (read-only)'}.`;
    },
    async run({ missionId, email, role }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      const limit = await checkRateLimit(`share:${userId}`, 20, 3600);
      if (!limit.success) throw new ToolError('Too many invitations. Try again later.');
      try {
        await addMember(userId, missionId, email.toLowerCase(), role, userId);
      } catch (e) {
        throw new ToolError(e instanceof Error ? e.message : 'Could not share');
      }
      return { success: true };
    },
  },
  {
    name: 'update_member_role',
    title: 'Change member role',
    description: 'Changes a collaborator role (viewer/editor) on a mission you own.',
    tier: 'critical',
    input: z.object({
      missionId: id,
      memberUserId: z.string().min(1).max(64),
      role: z.enum(['viewer', 'editor']),
    }),
    async preview({ missionId, memberUserId, role }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      const m = (await listMembers(userId, missionId)).find((x) => x.userId === memberUserId);
      return `Will change ${m?.name ?? memberUserId} (${m?.email ?? 'unknown'}) from ${m?.role} to ${role}.`;
    },
    async run({ missionId, memberUserId, role }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      try {
        await updateMemberRole(userId, missionId, memberUserId, role, userId);
      } catch (e) {
        throw new ToolError(e instanceof Error ? e.message : 'Could not update role');
      }
      return { success: true };
    },
  },
  {
    name: 'remove_member',
    title: 'Remove member',
    description: 'Revokes a collaborator access to a mission you own, effective immediately.',
    tier: 'critical',
    input: z.object({ missionId: id, memberUserId: z.string().min(1).max(64) }),
    async preview({ missionId, memberUserId }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      const m = (await listMembers(userId, missionId)).find((x) => x.userId === memberUserId);
      return `Will remove ${m?.name ?? memberUserId} (${m?.email ?? 'unknown'}) from the mission; they lose access immediately.`;
    },
    async run({ missionId, memberUserId }, { userId }) {
      await requireMissionAccess(userId, missionId, 'owner');
      try {
        await removeMember(userId, missionId, memberUserId, userId);
      } catch (e) {
        throw new ToolError(e instanceof Error ? e.message : 'Could not remove member');
      }
      return { success: true };
    },
  },
];
