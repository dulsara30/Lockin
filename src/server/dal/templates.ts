import { connectDB } from '@/lib/db';
import { Template } from '@/server/models/Template';
import { Mission } from '@/server/models/Mission';
import { Step } from '@/server/models/Step';
import { ParsedPlan } from '@/lib/templates/parser';

export async function getTemplates(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  return await Template.find({ userId }).sort({ createdAt: -1 }).lean().exec();
}

export async function getTemplateById(userId: string, templateId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!templateId) throw new Error('templateId is required');
  await connectDB();

  return await Template.findOne({ _id: templateId, userId }).lean().exec();
}

export async function createTemplate(
  userId: string,
  data: { name: string; description?: string; structure: ParsedPlan }
) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();

  const template = await Template.create({
    userId,
    name: data.name,
    description: data.description || '',
    structure: data.structure,
  });

  return template.toObject();
}

export async function deleteTemplate(userId: string, templateId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!templateId) throw new Error('templateId is required');
  await connectDB();

  const result = await Template.deleteOne({ _id: templateId, userId });
  return result.deletedCount > 0;
}

export async function saveMissionAsTemplate(
  userId: string,
  missionId: string,
  templateName: string
) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!missionId) throw new Error('missionId is required');
  await connectDB();

  const mission = await Mission.findOne({ _id: missionId, userId }).lean();
  if (!mission) throw new Error('Mission not found');

  const steps = await Step.find({ userId, missionId }).sort({ dayIndex: 1, order: 1 }).lean();

  // Convert mission and steps into a ParsedPlan structure
  const daysMap = new Map<number, ParsedPlan['days'][0]['steps']>();
  for (let d = 0; d < mission.dayCount; d++) {
    daysMap.set(d, []);
  }

  for (const step of steps) {
    if (!daysMap.has(step.dayIndex)) {
      daysMap.set(step.dayIndex, []);
    }
    daysMap.get(step.dayIndex)!.push({
      title: step.title,
      estimateMin: step.estimateMin,
      priority: 'medium',
      notes: step.notes,
      checklist: step.checklist?.map((c) => ({ text: c.text, done: false })),
    });
  }

  const structure: ParsedPlan = {
    title: mission.title,
    description: mission.description,
    dayCount: mission.dayCount,
    hoursPerDay: 4,
    priority: (mission.priority as 'low' | 'medium' | 'high') || 'medium',
    tags: mission.tags || [],
    days: Array.from(daysMap.entries()).map(([dayIndex, daySteps]) => ({
      dayIndex,
      steps: daySteps,
    })),
  };

  return await createTemplate(userId, {
    name: templateName || `${mission.title} Template`,
    description: mission.description,
    structure,
  });
}
