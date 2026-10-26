import crypto from 'crypto';

/** Constant-time bearer token check. Compares fixed-length digests to avoid length leaks. */
export function verifyBearer(authHeader: string | null | undefined, secret: string): boolean {
  if (!authHeader || !secret) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const a = crypto.createHash('sha256').update(match[1]).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * DNS-rebinding / browser-origin guard required by the MCP transport spec.
 * Non-browser clients (Claude Code, mcp-remote) send no Origin and are allowed;
 * a browser Origin must be same-host or explicitly allow-listed.
 */
export function originAllowed(
  origin: string | null | undefined,
  host: string | null | undefined,
  allowList: string[]
): boolean {
  if (!origin) return true;
  if (allowList.includes(origin)) return true;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}
