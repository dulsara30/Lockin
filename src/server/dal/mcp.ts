import { connectDB } from '@/lib/db';
import { User } from '@/server/models/User';
import { McpAudit } from '@/server/models/McpAudit';

const SENSITIVE_KEY = /key|token|secret|password/i;

/** Compact, redacted JSON of tool arguments for the audit trail. */
export function summarizeArgs(args: unknown, max = 800): string {
  let out: string;
  try {
    out = JSON.stringify(args, (k, v) => {
      if (SENSITIVE_KEY.test(k)) return '[redacted]';
      if (typeof v === 'string' && v.length > 120) return `${v.slice(0, 120)}...`;
      return v;
    });
  } catch {
    out = '[unserializable]';
  }
  return (out ?? '').slice(0, max);
}

export async function logMcpCall(entry: {
  userId: string;
  tool: string;
  tier: 'read' | 'write' | 'critical';
  args: unknown;
  status: 'ok' | 'error' | 'confirmation_required';
  error?: string;
  ip?: string;
  durationMs: number;
}) {
  if (!entry.userId) return;
  await connectDB();
  await McpAudit.create({ ...entry, args: summarizeArgs(entry.args) });
}

/** The single identity MCP acts as: the account whose email is MCP_USER_EMAIL. */
export async function getUserByEmail(email: string) {
  await connectDB();
  return await User.findOne({ email: email.trim().toLowerCase() })
    .select('name email')
    .lean()
    .exec();
}

export async function getUserProfile(userId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();
  return await User.findOne({ _id: userId }).select('name email').lean().exec();
}
