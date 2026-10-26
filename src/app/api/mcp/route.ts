import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp, originAllowed, verifyBearer } from '@/lib/mcp/auth';
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
 * Remote MCP endpoint (Streamable HTTP transport, stateless, JSON responses).
 * Disabled (404) unless MCP_SECRET_KEY (>= 32 chars) and MCP_USER_EMAIL are configured.
 */
export async function POST(req: Request) {
  const secret = env.MCP_SECRET_KEY;
  const userEmail = env.MCP_USER_EMAIL;
  if (!secret || secret.length < 32 || !userEmail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const ip = clientIp(req.headers);
  const allowList = (env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!originAllowed(req.headers.get('origin'), req.headers.get('host'), allowList)) {
    return rpcError(403, -32000, 'Origin not allowed');
  }

  if (!verifyBearer(req.headers.get('authorization'), secret)) {
    // Throttle repeated failures per IP; never reveal why auth failed
    const fail = await checkRateLimit(`mcp-fail:${ip}`, 10, 600);
    return fail.success
      ? rpcError(401, -32001, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' })
      : rpcError(429, -32002, 'Too many attempts');
  }

  const limit = await checkRateLimit(`mcp:${ip}`, 120, 60);
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

  const handler = buildMcpHandler({ secret, userEmail, ip });
  const result = await handler.handle(body);
  if (result === null) return new Response(null, { status: 202, headers: NO_STORE });
  return NextResponse.json(result, { headers: NO_STORE });
}

// This server does not offer a standalone SSE stream or sessions
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST', ...NO_STORE } });
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
