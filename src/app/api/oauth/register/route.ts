import { z } from 'zod';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/mcp/auth';
import { isValidRedirectUri } from '@/lib/oauth/core';
import { registerClient } from '@/server/dal/oauth';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

const schema = z.object({
  client_name: z.string().trim().min(1).max(100).default('MCP client'),
  redirect_uris: z.array(z.string()).min(1).max(5),
  token_endpoint_auth_method: z.literal('none').optional(),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
  response_types: z.array(z.literal('code')).optional(),
});

const err = (status: number, error: string, description: string) =>
  Response.json({ error, error_description: description }, { status, headers: NO_STORE });

/** RFC 7591 dynamic client registration. Public clients only (PKCE), exact redirect URIs. */
export async function POST(req: Request) {
  const limit = await checkRateLimit(`oauth-register:${clientIp(req.headers)}`, 20, 3600);
  if (!limit.success) return err(429, 'too_many_requests', 'Too many registrations.');

  const raw = await req.text();
  if (raw.length > 8 * 1024) return err(413, 'invalid_client_metadata', 'Request too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return err(400, 'invalid_client_metadata', 'Body must be JSON.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(400, 'invalid_client_metadata', 'Invalid client metadata.');
  if (!parsed.data.redirect_uris.every(isValidRedirectUri)) {
    return err(400, 'invalid_redirect_uri', 'Redirect URIs must be https or loopback http.');
  }

  const client = await registerClient(parsed.data.client_name, parsed.data.redirect_uris);
  return Response.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: NO_STORE }
  );
}
