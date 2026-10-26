import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/mcp/auth';
import { readOAuthBody } from '@/lib/oauth/base-url';
import { revokeByToken } from '@/server/dal/oauth';

export const dynamic = 'force-dynamic';

/** RFC 7009: always answers 200 so callers cannot probe which tokens exist. */
export async function POST(req: Request) {
  const limit = await checkRateLimit(`oauth-revoke:${clientIp(req.headers)}`, 30, 60);
  if (!limit.success) return new Response(null, { status: 429 });

  const p = await readOAuthBody(req);
  if (p.token && p.token.length <= 200) {
    await revokeByToken(p.token, p.client_id || undefined);
  }
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
