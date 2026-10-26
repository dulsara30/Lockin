import crypto from 'crypto';

/**
 * Server-enforced "ask first" for critical tools.
 *
 * A critical call without a valid token never executes; it returns a preview and a
 * short-lived, signed token bound to (tool, exact arguments, user). Re-sending the same
 * call with that token confirms it. Clients cannot skip this step.
 */
export const CONFIRM_TTL_MS = 5 * 60 * 1000;

interface Payload {
  t: string; // tool
  h: string; // args hash
  u: string; // user
  e: number; // expiry (ms)
  j: string; // unique id (single use)
}

const b64 = (b: Buffer) => b.toString('base64url');

function key(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update('lockin-mcp-confirm-v1').digest();
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashArgs(args: unknown): string {
  return crypto.createHash('sha256').update(canonicalize(args)).digest('hex');
}

export function signConfirmToken(
  secret: string,
  tool: string,
  args: unknown,
  userId: string,
  now = Date.now()
): string {
  const payload: Payload = {
    t: tool,
    h: hashArgs(args),
    u: userId,
    e: now + CONFIRM_TTL_MS,
    j: crypto.randomBytes(12).toString('hex'),
  };
  const body = b64(Buffer.from(JSON.stringify(payload)));
  const sig = b64(crypto.createHmac('sha256', key(secret)).update(body).digest());
  return `${body}.${sig}`;
}

export type ConfirmResult = { ok: true; jti: string } | { ok: false; reason: string };

export function verifyConfirmToken(
  secret: string,
  token: string,
  tool: string,
  args: unknown,
  userId: string,
  now = Date.now()
): ConfirmResult {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return { ok: false, reason: 'malformed token' };

  const expected = crypto.createHmac('sha256', key(secret)).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'invalid token' };
  }

  let p: Payload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed token' };
  }
  if (p.e < now) return { ok: false, reason: 'token expired' };
  if (p.t !== tool || p.u !== userId || p.h !== hashArgs(args)) {
    return { ok: false, reason: 'token does not match this exact call' };
  }
  return { ok: true, jti: p.j };
}
