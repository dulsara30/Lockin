import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/mcp/auth';
import { getBaseUrl, readOAuthBody } from '@/lib/oauth/base-url';
import { isEmailAllowed, parseAllowedEmails, resourceUrl, verifyPkce } from '@/lib/oauth/core';
import { consumeAuthCode, issueTokens, refreshTokens, TokenResponse } from '@/server/dal/oauth';
import { getUserProfile } from '@/server/dal/mcp';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

const err = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: NO_STORE });

const ok = (t: TokenResponse) =>
  Response.json(
    {
      access_token: t.accessToken,
      token_type: 'Bearer',
      expires_in: t.expiresIn,
      refresh_token: t.refreshToken,
      scope: t.scopes.join(' '),
    },
    { headers: NO_STORE }
  );

export async function POST(req: Request) {
  const limit = await checkRateLimit(`oauth-token:${clientIp(req.headers)}`, 60, 60);
  if (!limit.success) return err('too_many_requests', 'Slow down.', 429);

  const p = await readOAuthBody(req);
  const base = getBaseUrl(req.headers, env.NEXTAUTH_URL);

  if (p.grant_type === 'authorization_code') {
    if (!p.code || !p.redirect_uri || !p.client_id || !p.code_verifier) {
      return err('invalid_request', 'Missing parameters.');
    }
    // Consuming first makes every attempt burn the code (single use, even if PKCE fails)
    const record = await consumeAuthCode(p.code);
    if (
      !record ||
      record.clientId !== p.client_id ||
      record.redirectUri !== p.redirect_uri ||
      !verifyPkce(p.code_verifier, record.codeChallenge)
    ) {
      return err('invalid_grant', 'Invalid or expired authorization code.');
    }
    if (p.resource && p.resource.replace(/\/$/, '') !== record.resource) {
      return err('invalid_target', 'Resource mismatch.');
    }
    if (record.resource !== resourceUrl(base)) {
      return err('invalid_target', 'Code was issued for a different resource.');
    }

    const user = await getUserProfile(record.userId);
    if (!user || !isEmailAllowed(user.email, parseAllowedEmails(env.MCP_ALLOWED_EMAILS))) {
      return err('access_denied', 'This account may not use MCP.', 403);
    }

    return ok(
      await issueTokens({
        userId: record.userId,
        clientId: record.clientId,
        scopes: record.scopes,
        resource: record.resource,
      })
    );
  }

  if (p.grant_type === 'refresh_token') {
    if (!p.refresh_token || !p.client_id) return err('invalid_request', 'Missing parameters.');
    const tokens = await refreshTokens(p.refresh_token, p.client_id);
    if (!tokens) return err('invalid_grant', 'Invalid or expired refresh token.');
    return ok(tokens);
  }

  return err('unsupported_grant_type', 'Unsupported grant type.');
}
