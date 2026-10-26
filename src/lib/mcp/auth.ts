/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function bearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}

/**
 * DNS-rebinding / browser-origin guard required by the MCP transport spec.
 * Non-browser clients (Claude Code, connector backends) send no Origin and are allowed;
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
