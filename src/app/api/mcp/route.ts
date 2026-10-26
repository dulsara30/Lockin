import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/ratelimit';
import { bearerToken, clientIp, originAllowed } from '@/lib/mcp/auth';
import { getBaseUrl } from '@/lib/oauth/base-url';
import { isEmailAllowed, parseAllowedEmails, resourceUrl, wwwAuthenticate } from '@/lib/oauth/core';
import { verifyAccessToken } from '@/server/dal/oauth';
import { getUserProfile } from '@/server/dal/mcp';
import { buildMcpHandler } from '@/server/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // AI-backed tools can take a while

const MAX_BODY_BYTES = 256 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

function rpcError(status: number, code: number, message: string, headers: HeadersInit = {}) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code, message } },
    { status, headers: { ...NO_STORE, ...headers } }
  );
}

/**
 * Remote MCP endpoint (Streamable HTTP, stateless, JSON responses), protected by OAuth 2.1.
 * Disabled (404) until MCP_ALLOWED_EMAILS lists at least one account.
 */
export async function POST(req: Request) {
  const allowedEmails = parseAllowedEmails(env.MCP_ALLOWED_EMAILS);
  if (allowedEmails.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const ip = clientIp(req.headers);
  const base = getBaseUrl(req.headers, env.NEXTAUTH_URL);
  const allowList = (env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!originAllowed(req.headers.get('origin'), req.headers.get('host'), allowList)) {
    return rpcError(403, -32000, 'Origin not allowed');
  }

  // --- Authentication: OAuth access token issued by this server for this resource
  const token = bearerToken(req.headers.get('authorization'));
  const verified = token ? await verifyAccessToken(token) : null;
  if (!verified || verified.resource !== resourceUrl(base)) {
    if (token) {
      // A presented-but-invalid token counts as a failure; a missing one is normal discovery
      const fail = await checkRateLimit(`mcp-fail:${ip}`, 20, 600);
      if (!fail.success) return rpcError(429, -32002, 'Too many attempts');
    }
    return rpcError(401, -32001, 'Unauthorized', {
      'WWW-Authenticate': wwwAuthenticate(base, token ? 'invalid_token' : undefined),
    });
  }

  // --- Authorization: the account must still be allowed (re-checked on every request)
  const user = await getUserProfile(verified.userId);
  if (!user || !isEmailAllowed(user.email, allowedEmails)) {
    return rpcError(403, -32003, 'This account is not allowed to use MCP');
  }

  const limit = await checkRateLimit(`mcp:${verified.userId}`, 120, 60);
  if (!limit.success) return rpcError(429, -32002, 'Rate limit exceeded');

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return rpcError(413, -32600, 'Request too large');
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return rpcError(413, -32600, 'Request too large');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcError(400, -32700, 'Parse error');
  }

  const handler = buildMcpHandler({
    secret: env.AUTH_SECRET,
    userId: verified.userId,
    clientId: verified.clientId,
    scopes: verified.scopes,
    ip,
  });
  const result = await handler.handle(body);
  if (result === null) return new Response(null, { status: 202, headers: NO_STORE });
  return NextResponse.json(result, { headers: NO_STORE });
}

// This server does not offer a standalone SSE stream or sessions
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST', ...NO_STORE } });
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
