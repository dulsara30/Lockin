import { env } from '@/lib/env';
import { getBaseUrl } from '@/lib/oauth/base-url';
import { authorizationServerMetadata } from '@/lib/oauth/core';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300',
};

// RFC 8414 authorization server metadata
export async function GET(req: Request) {
  const base = getBaseUrl(req.headers, env.NEXTAUTH_URL);
  return Response.json(authorizationServerMetadata(base), { headers: CORS });
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
