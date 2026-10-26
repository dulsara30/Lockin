/**
 * Public base URL of this deployment (the OAuth issuer / MCP resource origin).
 * Prefer the configured NEXTAUTH_URL; otherwise derive it from the forwarded host.
 */
export function getBaseUrl(headers: Headers, configured?: string): string {
  if (configured) return configured.replace(/\/+$/, '');
  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3000';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = headers.get('x-forwarded-proto')?.split(',')[0] || (local ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Reads an OAuth request body (form-encoded per spec; JSON tolerated) into a string map. */
export async function readOAuthBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') || '';
  const raw = await req.text();
  if (raw.length > 16 * 1024) return {};
  const out: Record<string, string> = {};
  if (type.includes('application/json')) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j === 'object') {
        for (const [k, v] of Object.entries(j)) if (typeof v === 'string') out[k] = v;
      }
    } catch {
      /* ignore malformed JSON */
    }
    return out;
  }
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}
