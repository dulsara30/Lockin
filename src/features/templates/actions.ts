'use server';

import { auth } from '@/lib/auth';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  deleteTemplate,
  saveMissionAsTemplate,
} from '@/server/dal/templates';
import { confirmAndSavePlanAction } from '@/features/brain-dump/actions';
import { revalidatePath } from 'next/cache';

export async function getTemplatesAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const templates = await getTemplates(session.user.id);
    return { success: true, templates };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to fetch templates' };
  }
}

export async function saveMissionAsTemplateAction(missionId: string, templateName: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const template = await saveMissionAsTemplate(session.user.id, missionId, templateName);
    revalidatePath('/templates');
    return { success: true, template };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to save template' };
  }
}

export async function deleteTemplateAction(templateId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await deleteTemplate(session.user.id, templateId);
    revalidatePath('/templates');
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to delete template' };
  }
}

export async function deployTemplateToMissionAction(templateId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const template = await getTemplateById(session.user.id, templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const res = await confirmAndSavePlanAction(template.structure);
    if (res.success && res.missionId) {
      revalidatePath('/missions');
      revalidatePath('/runway');
      return { success: true, missionId: res.missionId };
    }
    return { success: false, error: res.error || 'Failed to create mission from template' };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to instantiate template' };
  }
}
