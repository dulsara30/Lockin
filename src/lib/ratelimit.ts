import { connectDB } from './db';
import { RateLimit } from '@/server/models/RateLimit';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

/**
 * Serverless-safe rate limiting backed by MongoDB TTL index.
 * @param key unique identifier (e.g. `signup:ip` or `login:email`)
 * @param limit max allowed requests within window
 * @param windowSeconds time window in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    await connectDB();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

    const doc = await RateLimit.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    const count = doc?.count || 1;
    const isAllowed = count <= limit;

    return {
      success: isAllowed,
      limit,
      remaining: Math.max(0, limit - count),
      reset: doc?.expiresAt || expiresAt,
    };
  } catch (error) {
    // If rate limiting DB check fails, log warning without PII and fail open in development or fail gracefully
    console.error('Rate limit check error:', error instanceof Error ? error.message : 'Unknown');
    // Allow request to avoid breaking app if DB is temporarily unreachable during non-critical paths
    return {
      success: true,
      limit,
      remaining: 1,
      reset: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}
