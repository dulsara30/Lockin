'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/ratelimit';
import { getBaseUrl } from '@/lib/oauth/base-url';
import {
  isEmailAllowed,
  parseAllowedEmails,
  parseAuthorizeRequest,
  redirectUriMatches,
  resourceUrl,
  scopesForLevel,
} from '@/lib/oauth/core';
import { createAuthCode, getClient, revokeConnectedApp } from '@/server/dal/oauth';

const decisionSchema = z.object({
  decision: z.enum(['allow', 'deny']),
  level: z.enum(['read', 'write', 'critical']).default('read'),
});

function redirectBack(redirectUri: string, params: Record<string, string | undefined>): never {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  redirect(url.toString());
}

/**
 * Consent decision. Everything is re-validated here (never trusting the form's hidden
 * fields): session, account allow-list, client registration, exact redirect URI and PKCE.
 */
export async function submitAuthorizationAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const allowed = parseAllowedEmails(env.MCP_ALLOWED_EMAILS);
  if (!isEmailAllowed(session.user?.email, allowed)) redirect('/oauth/authorize');

  const base = getBaseUrl(await headers(), env.NEXTAUTH_URL);
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>;

  const request = parseAuthorizeRequest(
    { ...raw, response_type: 'code', code_challenge_method: raw.code_challenge_method },
    base
  );
  const decision = decisionSchema.safeParse(raw);
  if (!request.ok || !decision.success) redirect('/oauth/authorize');

  const client = await getClient(request.params.clientId);
  if (!client || !redirectUriMatches(client.redirectUris, request.params.redirectUri)) {
    redirect('/oauth/authorize');
  }

  const { redirectUri, state } = request.params;

  if (decision.data.decision === 'deny') {
    redirectBack(redirectUri, { error: 'access_denied', state });
  }

  const limit = await checkRateLimit(`oauth-approve:${userId}`, 20, 600);
  if (!limit.success) redirectBack(redirectUri, { error: 'temporarily_unavailable', state });

  const code = await createAuthCode({
    clientId: client.clientId,
    userId,
    redirectUri,
    codeChallenge: request.params.codeChallenge,
    scopes: scopesForLevel(decision.data.level),
    resource: resourceUrl(base),
  });
  return redirectBack(redirectUri, { code, state });
}

/** Settings > Connected apps: revoke one grant (scoped to the signed-in user). */
export async function revokeConnectedAppAction(grantId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: 'Unauthorized' };
  const done = await revokeConnectedApp(session.user.id, grantId);
  revalidatePath('/settings');
  return done
    ? { success: true as const }
    : { success: false as const, error: 'Connection not found' };
}
