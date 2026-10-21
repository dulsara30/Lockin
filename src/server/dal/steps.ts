import { connectDB } from '@/lib/db';
import { Step, IChecklistItem } from '@/server/models/Step';
import { Activity } from '@/server/models/Activity';
import { StepStatus } from '@/lib/planning';
import { generateKeyBetween } from 'fractional-indexing';

export interface CreateStepDTO {
  missionId: string;
  runwayId?: string;
  dayIndex: number;
  title: string;
  notes?: string;
  estimateMin?: number;
  status?: StepStatus;
  checklist?: IChecklistItem[];
  order?: string;
}

export interface UpdateStepDTO {
  title?: string;
  notes?: string;
  estimateMin?: number;
  actualMin?: number;
  status?: StepStatus;
  dayIndex?: number;
  order?: string;
  checklist?: IChecklistItem[];
  customFields?: Record<string, unknown>;
}

export async function getAllSteps(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  return await Step.find({ userId }).lean().exec();
}

export async function getStepsByMission(userId: string, missionId: string, runwayId?: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  const filter: Record<string, unknown> = { userId, missionId };
  if (runwayId) {
    filter.runwayId = runwayId;
  }

  return await Step.find(filter).sort({ dayIndex: 1, order: 1 }).lean().exec();
}

export async function getStepsByRunway(userId: string, runwayId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!runwayId) throw new Error('runwayId is required');
  await connectDB();

  return await Step.find({ userId, runwayId }).sort({ dayIndex: 1, order: 1 }).lean().exec();
}

export async function getStepsForToday(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  // Query active steps for today across missions
  return await Step.find({
    userId,
    status: { $in: ['todo', 'doing', 'blocked'] },
  })
    .sort({ dayIndex: 1, order: 1 })
    .limit(50)
    .lean()
    .exec();
}

export async function getStepById(userId: string, stepId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  return await Step.findOne({ _id: stepId, userId }).lean().exec();
}

export async function createStep(userId: string, data: CreateStepDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  let orderKey = data.order;
  if (!orderKey) {
    // Determine fractional order key based on last item in this day
    const query: Record<string, unknown> = {
      userId,
      missionId: data.missionId,
      dayIndex: data.dayIndex,
    };
    if (data.runwayId) {
      query.runwayId = data.runwayId;
    }

    const lastStep = await Step.findOne(query).sort({ order: -1 }).lean().exec();

    orderKey = generateKeyBetween(lastStep ? lastStep.order : null, null);
  }

  const step = await Step.create({
    userId,
    missionId: data.missionId,
    runwayId: data.runwayId || undefined,
    dayIndex: data.dayIndex,
    order: orderKey,
    title: data.title,
    notes: data.notes || '',
    estimateMin: data.estimateMin ?? 30,
    actualMin: 0,
    status: data.status || 'todo',
    checklist: data.checklist || [],
  });

  return step.toObject();
}

export async function updateStep(userId: string, stepId: string, data: UpdateStepDTO) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  const prevStep = await Step.findOne({ _id: stepId, userId }).lean();
  if (!prevStep) return null;

  const updated = await Step.findOneAndUpdate(
    { _id: stepId, userId },
    { $set: data },
    { new: true }
  )
    .lean()
    .exec();

  // If status changed to 'done', log completed activity
  if (data.status === 'done' && prevStep.status !== 'done') {
    await Activity.create({
      userId,
      type: 'completed',
      missionId: prevStep.missionId,
      stepId: prevStep._id,
      metadata: { title: prevStep.title, estimateMin: prevStep.estimateMin },
      at: new Date(),
    });
  }

  return updated;
}

/**
 * Single-write reordering within or between days using fractional indexing.
 */
export async function reorderStep(
  userId: string,
  stepId: string,
  newDayIndex: number,
  newOrder: string
) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  const updated = await Step.findOneAndUpdate(
    { _id: stepId, userId },
    { $set: { dayIndex: newDayIndex, order: newOrder } },
    { new: true }
  )
    .lean()
    .exec();

  if (updated) {
    await Activity.create({
      userId,
      type: 'moved',
      missionId: updated.missionId,
      stepId: updated._id,
      metadata: { dayIndex: newDayIndex, order: newOrder },
      at: new Date(),
    });
  }

  return updated;
}

export async function deleteStep(userId: string, stepId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  return await Step.findOneAndDelete({ _id: stepId, userId }).lean().exec();
}

/**
 * Rolls over multiple unfinished steps from past days into new day.
 */
export async function rolloverSteps(
  userId: string,
  missionId: string,
  moves: { id: string; toDay: number }[]
) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  const operations = moves.map((move) => ({
    updateOne: {
      filter: { _id: move.id, userId, missionId },
      update: { $set: { dayIndex: move.toDay } },
    },
  }));

  if (operations.length > 0) {
    await Step.bulkWrite(operations);

    await Activity.create({
      userId,
      type: 'rolled_over',
      missionId,
      metadata: { stepCount: moves.length, targetDays: moves.map((m) => m.toDay) },
      at: new Date(),
    });
  }

  return { success: true, count: moves.length };
}
