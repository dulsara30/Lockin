import { connectDB } from '@/lib/db';
import { AiUsage } from '@/server/models/AiUsage';
import { env } from '@/lib/env';

export interface AiUsageCheckResult {
  allowed: boolean;
  calls: number;
  limit: number;
  remaining: number;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function checkAiUsage(
  userId: string,
  hasCustomKey: boolean
): Promise<AiUsageCheckResult> {
  if (!userId) throw new Error('Unauthorized: userId is required');
  await connectDB();

  const today = getTodayDateString();
  const limit = hasCustomKey ? 100 : env.AI_DAILY_CAP_SHARED;

  const usage = await AiUsage.findOne({ userId, date: today }).lean();
  const calls = usage?.calls || 0;
  const remaining = Math.max(0, limit - calls);

  return {
    allowed: calls < limit,
    calls,
    limit,
    remaining,
  };
}

export async function checkAndIncrementAiUsage(
  userId: string,
  hasCustomKey: boolean
): Promise<AiUsageCheckResult> {
  if (!userId) throw new Error('Unauthorized: userId is required');
  await connectDB();

  const today = getTodayDateString();
  const limit = hasCustomKey ? 100 : env.AI_DAILY_CAP_SHARED;

  // Use findOneAndUpdate with condition calls < limit to atomically prevent race condition overages
  const updated = await AiUsage.findOneAndUpdate(
    { userId, date: today, calls: { $lt: limit } },
    { $inc: { calls: 1 } },
    { new: true, upsert: false }
  );

  if (updated) {
    return {
      allowed: true,
      calls: updated.calls,
      limit,
      remaining: Math.max(0, limit - updated.calls),
    };
  }

  // Check if document exists or limit was reached
  const current = await AiUsage.findOne({ userId, date: today });
  if (!current) {
    // First call of the day
    const newUsage = await AiUsage.create({ userId, date: today, calls: 1 });
    return {
      allowed: true,
      calls: 1,
      limit,
      remaining: Math.max(0, limit - 1),
    };
  }

  return {
    allowed: false,
    calls: current.calls,
    limit,
    remaining: 0,
  };
}
