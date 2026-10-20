import { connectDB } from '@/lib/db';
import { Settings, ISettings } from '@/server/models/Settings';
import { encrypt, decrypt } from '@/lib/crypto';

export interface UserSettingsResponse {
  theme: 'dark' | 'light' | 'system';
  accent: string;
  density: 'compact' | 'comfortable';
  timezone: string;
  weekStart: 0 | 1 | 6;
  workHoursPerDay: number;
  capacityByWeekday: Record<string, number>;
  customStatuses: string[];
  customFields: Array<{ id: string; name: string; type: string }>;
  shortcutOverrides: Record<string, string>;
  hasCustomGeminiKey: boolean;
}

export async function getUserSettings(userId: string): Promise<UserSettingsResponse> {
  if (!userId) throw new Error('Unauthorized: userId is required');
  await connectDB();

  let settings = await Settings.findOne({ userId });
  if (!settings) {
    settings = await Settings.create({ userId });
  }

  const rawCapacity = settings.capacityByWeekday;
  const capacityObj: Record<string, number> =
    rawCapacity instanceof Map
      ? Object.fromEntries(rawCapacity)
      : (rawCapacity as Record<string, number>) || {};

  const rawShortcuts = settings.shortcutOverrides;
  const shortcutsObj: Record<string, string> =
    rawShortcuts instanceof Map
      ? Object.fromEntries(rawShortcuts)
      : (rawShortcuts as Record<string, string>) || {};

  return {
    theme: settings.theme,
    accent: settings.accent,
    density: settings.density,
    timezone: settings.timezone,
    weekStart: settings.weekStart,
    workHoursPerDay: settings.workHoursPerDay,
    capacityByWeekday: capacityObj,
    customStatuses: settings.customStatuses || [],
    customFields: settings.customFields || [],
    shortcutOverrides: shortcutsObj,
    hasCustomGeminiKey: Boolean(settings.encryptedGeminiKey),
  };
}

export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<ISettings, 'userId' | 'encryptedGeminiKey'>> & {
    geminiApiKey?: string | null;
  }
): Promise<UserSettingsResponse> {
  if (!userId) throw new Error('Unauthorized: userId is required');
  await connectDB();

  const updateData: Record<string, unknown> = { ...updates };

  if (updates.geminiApiKey !== undefined) {
    if (updates.geminiApiKey === null || updates.geminiApiKey.trim() === '') {
      updateData.encryptedGeminiKey = null;
    } else {
      updateData.encryptedGeminiKey = encrypt(updates.geminiApiKey.trim());
    }
    delete updateData.geminiApiKey;
  }

  await Settings.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { upsert: true, new: true, runValidators: true }
  );

  return getUserSettings(userId);
}

/**
 * Internal DAL helper to resolve the user's decrypted Gemini key if provided
 */
export async function getDecryptedGeminiKey(userId: string): Promise<string | null> {
  if (!userId) return null;
  await connectDB();

  const settings = await Settings.findOne({ userId }, { encryptedGeminiKey: 1 }).lean();
  if (!settings?.encryptedGeminiKey) return null;

  try {
    return decrypt(settings.encryptedGeminiKey);
  } catch (error) {
    console.error('Failed to decrypt user Gemini key:', error);
    return null;
  }
}
